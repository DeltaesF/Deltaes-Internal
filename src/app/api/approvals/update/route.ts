import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Firebase 초기화
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

// ----------------------------------------------------------------
// [1] 데이터 타입 정의 (Create와 구조 통일)
// ----------------------------------------------------------------

// 신규 타입 정의
interface TransportCosts {
  bus: number;
  subway: number;
  taxi: number;
  other: number;
}
interface ExpenseItem {
  date: string;
  detail: string;
}

// 금액/비용 정보 (구매 품의서용)
interface PriceDetails {
  orig: string;
  mod: string;
}
interface PriceData {
  list: PriceDetails;
  contract: PriceDetails;
  dc: PriceDetails;
  salesNet: PriceDetails;
  profit: PriceDetails;
  warranty: PriceDetails;
  remarks: string;
}

interface CostDetails {
  act: string;
  nom: string;
  desc: string;
}
interface CostData {
  transport: CostDetails;
  warranty: CostDetails;
  travel: CostDetails;
  overseas: CostDetails;
  personnel: CostDetails;
  material: CostDetails;
  extraWarranty: CostDetails;
  rental: CostDetails;
  interest: CostDetails;
  other: CostDetails;
  subtotal: { act: string; nom: string };
  docTypes: string[];
  total: { val: string; desc: string };
}

// 통합 업데이트 데이터 인터페이스 (모든 필드 Optional)
interface UpdatePayload {
  title?: string;
  content?: string;
  updatedAt: FieldValue;

  // ✅ [추가] 통합 외근/출장용 필드
  workType?: string;
  transportType?: string;

  customerDept?: string;
  customerEmail?: string;
  customerContact?: string; // 담당자 이름

  usageDate?: string | null;
  tripPeriod?: string | null;

  tripDestination?: string | null;
  tripCompanions?: string | null;
  tripExpenses?: ExpenseItem[];
  transportCosts?: TransportCosts | null;

  // 🚗 차량/외근용
  contact?: string | null;
  isExternalWork?: boolean;
  isVehicleUse?: boolean;
  isPersonalVehicle?: boolean;
  implementDate?: string | null;
  vehicleModel?: string | null;
  usagePeriod?: string | null;

  // 🛒 구매/판매용
  serialNumber?: string;
  customerName?: string;
  product?: string;
  endUser?: string;
  customerInfo?: string;
  contractDate?: string;
  introductionType?: string;
  introductionMemo?: string;
  deliveryDate?: string;
  paymentPending?: string;
  paymentPendingAmount?: string;
  billingDate?: string;
  cashCollection?: string;
  cashCollectionDays?: string;
  collectionDate?: string;
  noteCollection?: string;
  noteCollectionDays?: string;
  noteMaturityDate?: string;
  specialNotes?: string;
  priceData?: PriceData;
  costData?: CostData;
  attachments?: { name: string; url: string }[];

  // 인덱스 시그니처 (동적 할당용)
  [key: string]:
    | string
    | number
    | boolean
    | object
    | undefined
    | null
    | FieldValue;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. 공통 및 식별 필드 추출
    const {
      id,
      userName,
      approvalType, // 'purchase' | 'vehicle' | ...

      // 공통 수정 가능 필드
      title,
      content,
      attachments,

      // ✅ [추가] 통합 외근/출장 필드
      workType,
      transportType,
      customerDept,
      customerEmail,
      customerContact,
      usageDate,
      tripPeriod,
      tripDestination,
      tripCompanions,
      tripExpenses,
      transportCosts,

      // 🚗 차량용 필드
      contact,
      isExternalWork,
      isVehicleUse,
      isPersonalVehicle,
      implementDate,
      vehicleModel,
      usagePeriod,

      // 🛒 구매용 필드
      serialNumber,
      customerName,
      product,
      endUser,
      customerInfo,
      contractDate,
      introductionType,
      introductionMemo,
      deliveryDate,
      paymentPending,
      paymentPendingAmount,
      billingDate,
      cashCollection,
      cashCollectionDays,
      collectionDate,
      noteCollection,
      noteCollectionDays,
      noteMaturityDate,
      specialNotes,
      priceData,
      costData,
    } = body;

    if (!id || !userName) {
      return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });
    }

    // 2. 문서 조회 및 권한 확인
    const docRef = db
      .collection("approvals")
      .doc(userName)
      .collection("userApprovals")
      .doc(id);

    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "문서 없음" }, { status: 404 });
    }

    // 본인 확인 (이미 경로에 userName이 들어가지만 더블 체크)
    if (doc.data()?.userName !== userName) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    // 3. 업데이트 데이터 구성
    const updateData: UpdatePayload = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 공통 필드 업데이트
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (attachments) updateData.attachments = attachments;

    // ✅ 타입별 분기 처리
    if (approvalType === "integrated_outside") {
      // [신규] 통합 외근/출장 업데이트
      Object.assign(updateData, {
        workType,
        transportType,
        implementDate,

        // 고객 정보
        customerName,
        customerDept,
        customerEmail,
        customerContact,

        // 기간 (null 처리 주의)
        usageDate: usageDate ?? null,
        tripPeriod: tripPeriod ?? null,

        // 상세 정보
        vehicleModel: vehicleModel ?? null,
        transportCosts: transportCosts ?? null,
        tripDestination: tripDestination ?? null,
        tripCompanions: tripCompanions ?? null,
        tripExpenses: tripExpenses ?? [],
      });
    } else if (approvalType === "purchase" || approvalType === "sales") {
      // [기존] 구매/판매 품의서 업데이트
      Object.assign(updateData, {
        serialNumber,
        customerName,
        product,
        endUser,
        customerInfo,
        contractDate,
        introductionType,
        introductionMemo,
        deliveryDate,
        paymentPending,
        paymentPendingAmount,
        billingDate,
        cashCollection,
        cashCollectionDays,
        collectionDate,
        noteCollection,
        noteCollectionDays,
        noteMaturityDate,
        specialNotes,
        priceData,
        costData,
      });

      // 제목 자동 업데이트 (옵션)
      // 사용자가 제목을 직접 수정하지 않았고, 고객명/제품명이 변경된 경우 제목 갱신
      if (!title && customerName && product) {
        updateData.title = `[${
          approvalType === "purchase" ? "구매" : "판매"
        }품의] ${customerName}_${product}`;
      }
    } else if (approvalType === "vehicle") {
      // 🚗 차량 신청서 필드 업데이트
      // (undefined 체크는 하지 않고 넘어온 값 그대로 덮어쓰거나 null 처리)
      // 값이 있을 때만 업데이트하려면 아래처럼 조건문 사용, 여기서는 body에서 undefined면 무시되도록 Object.assign 사용 시 주의

      if (contact !== undefined) updateData.contact = contact;
      if (isExternalWork !== undefined)
        updateData.isExternalWork = isExternalWork;
      if (isVehicleUse !== undefined) updateData.isVehicleUse = isVehicleUse;
      if (isPersonalVehicle !== undefined)
        updateData.isPersonalVehicle = isPersonalVehicle;
      if (implementDate !== undefined) updateData.implementDate = implementDate;
      if (vehicleModel !== undefined) updateData.vehicleModel = vehicleModel;
      if (usagePeriod !== undefined) updateData.usagePeriod = usagePeriod;
    }

    // 4. DB 업데이트 실행
    await docRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval Update Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
