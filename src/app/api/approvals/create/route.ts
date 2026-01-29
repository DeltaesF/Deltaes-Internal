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
// [Type Definitions]
// ----------------------------------------------------------------

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

// 기존 구매/판매용 (유지)
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

interface CreateRequestBody {
  userName: string;
  title: string;
  content: string;
  approvalType?: string;
  attachments?: { name: string; url: string }[];
  createdAt?: number | FieldValue;

  // 외근/출장 통합 필드
  workType?: "outside" | "trip";
  transportType?: "company_car" | "personal_car" | "public" | "other";
  implementDate?: string;

  // 방문고객 상세정보 (New Fields)
  customerName?: string;
  customerDept?: string;
  customerEmail?: string;
  customerContact?: string; // 이름(담당자)

  // 기간 (New: usageDate for outside)
  usageDate?: string | null;
  tripPeriod?: string | null;

  // 조건부 (null 허용)
  vehicleModel?: string | null;
  usagePeriod?: string | null; // deprecated
  transportCosts?: TransportCosts | null;

  // 출장용 (null 허용)
  tripDestination?: string | null;
  tripCompanions?: string | null;
  tripExpenses?: ExpenseItem[];

  // 구매/판매용 (호환성 유지)
  serialNumber?: string;
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

// Partial을 사용하여 선택적 필드로 구성하되, null 타입도 허용하도록 정의
interface ApprovalDocData extends Partial<CreateRequestBody> {
  department: string;
  approvers: {
    first: string[];
    second: string[];
    third: string[];
    shared: string[];
  };
  status: string;
  createdAt: number | FieldValue;
  resultReport?: string;
}

export async function POST(req: Request) {
  try {
    const body: CreateRequestBody = await req.json();
    const {
      userName,
      title,
      content,
      approvalType = "purchase",
      attachments,
      createdAt,
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

    let approvalLine = {
      first: [] as string[],
      second: [] as string[],
      third: [] as string[],
      shared: [] as string[],
    };
    let department = "";

    if (!employeeQuery.empty) {
      const empData = employeeQuery.docs[0].data();
      approvalLine = empData.recipients?.approval || approvalLine;
      department = empData.department || "";
    }

    // 2. 기본 데이터 구성
    const docData: ApprovalDocData = {
      approvalType,
      title: title || `[결재] ${userName}`,
      content: content || "",
      userName,
      department,
      approvers: approvalLine,
      status: "1차 결재 대기",
      createdAt: createdAt || FieldValue.serverTimestamp(),
      attachments: attachments || [],
      resultReport: "",
    };

    // 3. 타입별 데이터 병합
    if (approvalType === "integrated_outside") {
      // 통합 외근/출장 데이터 저장
      docData.workType = body.workType;
      docData.transportType = body.transportType;
      docData.implementDate = body.implementDate;

      // 상세정보
      docData.customerName = body.customerName;
      docData.customerDept = body.customerDept;
      docData.customerEmail = body.customerEmail;
      docData.customerContact = body.customerContact;

      // 기간 저장
      docData.usageDate = body.usageDate ?? null;
      docData.tripPeriod = body.tripPeriod ?? null;

      // ✅ [핵심 수정] undefined가 되지 않도록 ?? null 사용
      docData.vehicleModel = body.vehicleModel ?? null;
      docData.transportCosts = body.transportCosts ?? null;

      docData.tripDestination = body.tripDestination ?? null;
      docData.tripCompanions = body.tripCompanions ?? null;
      docData.tripExpenses = body.tripExpenses || [];
    } else if (approvalType === "purchase" || approvalType === "sales") {
      // 구매/판매 데이터 저장
      Object.assign(docData, {
        serialNumber: body.serialNumber,
        customerName: body.customerName,
        product: body.product,
        endUser: body.endUser,
        customerInfo: body.customerInfo,
        contractDate: body.contractDate,
        introductionType: body.introductionType,
        introductionMemo: body.introductionMemo,
        deliveryDate: body.deliveryDate,
        paymentPending: body.paymentPending,
        paymentPendingAmount: body.paymentPendingAmount,
        billingDate: body.billingDate,
        cashCollection: body.cashCollection,
        cashCollectionDays: body.cashCollectionDays,
        collectionDate: body.collectionDate,
        noteCollection: body.noteCollection,
        noteCollectionDays: body.noteCollectionDays,
        noteMaturityDate: body.noteMaturityDate,
        specialNotes: body.specialNotes,
        priceData: body.priceData,
        costData: body.costData,
      });
      if (!title)
        docData.title = `[${
          approvalType === "purchase" ? "구매" : "판매"
        }품의] ${body.customerName}_${body.product}`;
    }

    // 4. DB 저장
    const docRef = db
      .collection("approvals")
      .doc(userName)
      .collection("userApprovals")
      .doc();

    // JSON.parse(JSON.stringify()) 트릭을 사용하여 혹시 모를 undefined 제거 (안전장치)
    const cleanDocData = JSON.parse(JSON.stringify(docData));
    await docRef.set(cleanDocData);

    // 5. 알림 발송
    const batch = db.batch();
    const firstApprovers = approvalLine.first || [];

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
        message: `${docData.title} 결재 요청이 도착했습니다.`,
        link: `/main/my-approval/pending`,
        isRead: false,
        createdAt: Date.now(),
        approvalId: docRef.id,
      });
    });

    const futureApprovers = [
      ...(approvalLine.second || []),
      ...(approvalLine.third || []),
    ];
    const sharedUsers = approvalLine.shared || [];
    const allReferenceUsers = [
      ...new Set([...futureApprovers, ...sharedUsers]),
    ];

    allReferenceUsers.forEach((targetName) => {
      if (firstApprovers.includes(targetName)) return;
      const notiRef = db
        .collection("notifications")
        .doc(targetName)
        .collection("userNotifications")
        .doc();

      let message = "";
      if (futureApprovers.includes(targetName)) {
        message = `[공유/예정] ${docData.title} 결재 요청이 도착했습니다.`;
      } else {
        message = `[공유] ${docData.title}`;
      }

      batch.set(notiRef, {
        targetUserName: targetName,
        fromUserName: userName,
        type: "approval",
        message,
        link: `/main/workoutside/approvals/${docRef.id}`,
        isRead: false,
        createdAt: Date.now(),
        approvalId: docRef.id,
      });
    });

    await batch.commit();
    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error("API Error:", error);
    const msg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
