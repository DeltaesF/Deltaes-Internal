import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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
// [1] 데이터 타입 정의
// ----------------------------------------------------------------

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

// 통합 문서 데이터 인터페이스
interface ApprovalData {
  approvalType: string;
  title: string;
  content: string;
  userName: string;
  department: string;
  approvers: {
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };
  status: string;
  createdAt: FieldValue;

  // ✅ attachments는 선택적 필드로 정의 (조건부 저장)
  attachments?: { name: string; url: string }[];

  // 🚗 차량/외근용 선택 필드
  contact?: string;
  isExternalWork?: boolean;
  isVehicleUse?: boolean;
  isPersonalVehicle?: boolean;
  implementDate?: string;
  vehicleModel?: string;
  usagePeriod?: string;

  // 🛒 구매/판매 품의서용 선택 필드
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
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      userName,
      title,
      content,
      approvalType = "purchase",
      attachments, // ✅ 첨부파일 추출 (rest에 포함되지 않음)

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

    if (!userName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. 직원 정보(결재선) 조회
    const employeeQuery = await db
      .collection("employee")
      .where("userName", "==", userName)
      .get();
    let approvalLine = { first: [], second: [], third: [], shared: [] };
    let department = "";

    if (!employeeQuery.empty) {
      const empData = employeeQuery.docs[0].data();
      approvalLine = empData.recipients?.approval || approvalLine;
      department = empData.department || "";
    }

    // 2. 기본 데이터 구성 (공통 필드)
    // ⚠️ 여기서 attachments를 기본으로 넣지 않음
    const docData: ApprovalData = {
      approvalType,
      title:
        title ||
        (approvalType === "vehicle"
          ? `[차량신청] ${userName}`
          : `[품의서] ${customerName}_${product}`),
      content: content || "내용 없음",
      userName,
      department,
      approvers: approvalLine,
      status: "1차 결재 대기",
      createdAt: FieldValue.serverTimestamp(),
    };

    // 3. ✅ 타입별 필드 분기 처리
    if (approvalType === "purchase" || approvalType === "sales") {
      // 🛒 구매/판매 품의서일 때만 첨부파일 및 관련 데이터 저장
      Object.assign(docData, {
        attachments: attachments || [], // ✅ 여기에만 추가
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
      // 제목 자동 생성 로직 (필요시)
      if (!title) {
        docData.title = `[${
          approvalType === "purchase" ? "구매" : "판매"
        }품의] ${customerName}_${product}`;
      }
    } else if (approvalType === "vehicle") {
      // 🚗 차량 신청서 (첨부파일 없음)
      Object.assign(docData, {
        contact: contact || null,
        isExternalWork: isExternalWork || false,
        isVehicleUse: isVehicleUse || false,
        isPersonalVehicle: isPersonalVehicle || false,
        implementDate: implementDate || null,
        vehicleModel: vehicleModel || null,
        usagePeriod: usagePeriod || null,
      });
    }

    // 4. DB 저장
    const docRef = db
      .collection("approvals")
      .doc(userName)
      .collection("userApprovals")
      .doc();
    await docRef.set(docData);

    // 5. 알림 발송
    const batch = db.batch();
    const firstApprovers: string[] = approvalLine.first || [];

    firstApprovers.forEach((approver) => {
      const notiRef = db
        .collection("notifications")
        .doc(approver)
        .collection("userNotifications")
        .doc();
      batch.set(notiRef, {
        targetUserName: approver,
        fromUserName: userName,
        type: "approval",
        message: `[${approvalType === "vehicle" ? "차량" : "품의"}/1차결재] ${
          docData.title
        }_${userName} 결재 요청이 도착했습니다.`,
        link: `/main/my-approval/pending`,
        isRead: false,
        createdAt: Date.now(),
        approvalId: docRef.id,
      });
    });

    const referenceUsers = [
      ...(approvalLine.second || []),
      ...(approvalLine.third || []),
      ...(approvalLine.shared || []),
    ];
    const uniqueRefs = [...new Set(referenceUsers)] as string[];

    uniqueRefs.forEach((targetName: string) => {
      if (firstApprovers.includes(targetName)) return;
      const notiRef = db
        .collection("notifications")
        .doc(targetName)
        .collection("userNotifications")
        .doc();
      batch.set(notiRef, {
        targetUserName: targetName,
        fromUserName: userName,
        type: "approval",
        message: `[공유/예정] ${docData.title}_${userName} 결재 요청이 도착했습니다.`,
        link: `/main/workoutside/approvals/${docRef.id}`,
        isRead: false,
        createdAt: Date.now(),
        approvalId: docRef.id,
      });
    });

    await batch.commit();

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
