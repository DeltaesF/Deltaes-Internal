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
  attachments?: { name: string; url: string }[];

  // 차량/외근용
  contact?: string;
  isExternalWork?: boolean;
  isVehicleUse?: boolean;
  isPersonalVehicle?: boolean;
  implementDate?: string;
  vehicleModel?: string;
  usagePeriod?: string;
  purpose?: string;

  // 구매/판매용
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
      attachments,

      // 차량용 필드
      contact,
      isExternalWork,
      isVehicleUse,
      isPersonalVehicle,
      implementDate,
      vehicleModel,
      usagePeriod,
      purpose,

      // 구매용 필드
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

    // ✅ [수정] 타입을 명시하여 never[] 추론 오류 방지
    let approvalLine: {
      first: string[];
      second: string[];
      third: string[];
      shared: string[];
    } = {
      first: [],
      second: [],
      third: [],
      shared: [],
    };

    let department = "";

    if (!employeeQuery.empty) {
      const empData = employeeQuery.docs[0].data();
      approvalLine = empData.recipients?.approval || approvalLine;
      department = empData.department || "";
    }

    // 2. 기본 데이터 구성
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

    // 3. 타입별 데이터 병합
    if (approvalType === "purchase" || approvalType === "sales") {
      Object.assign(docData, {
        attachments: attachments || [],
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
      if (!title)
        docData.title = `[${
          approvalType === "purchase" ? "구매" : "판매"
        }품의] ${customerName}_${product}`;
    } // ✅ [통합] 차량신청서(vehicle) 또는 출장보고서(business_trip)
    else if (approvalType === "vehicle" || approvalType === "business_trip") {
      Object.assign(docData, {
        contact: contact || null,
        isExternalWork: isExternalWork || false,
        isVehicleUse: isVehicleUse || false,
        isPersonalVehicle: isPersonalVehicle || false,
        implementDate: implementDate || null,
        vehicleModel: vehicleModel || null,
        usagePeriod: usagePeriod || null,
        purpose: purpose || null,
      });
      // 제목은 프론트엔드에서 이미 말머리를 붙여서 보냄 (fallback만 처리)
      if (!title)
        docData.title = `[${
          approvalType === "vehicle" ? "차량" : "출장"
        }] ${userName}`;
    }

    // 4. DB 저장
    const docRef = db
      .collection("approvals")
      .doc(userName)
      .collection("userApprovals")
      .doc();
    await docRef.set(docData);

    // ----------------------------------------------------------------
    // 5. ✅ 알림 발송 (타입 오류 수정됨)
    // ----------------------------------------------------------------
    const batch = db.batch();

    // (A) 1차 결재자 (지금 결재해야 할 사람)
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
        // ✅ 제목에 이미 말머리가 있으므로 그대로 사용
        message: `${docData.title} 결재 요청이 도착했습니다.`,
        link: `/main/my-approval/pending`,
        isRead: false,
        createdAt: Date.now(),
        approvalId: docRef.id,
      });
    });

    // (B) 참조자 목록 (2차, 3차, 공유자 전체)
    // 이제 approvalLine이 명시적 타입을 가지므로 futureApprovers는 string[]으로 추론됨
    const futureApprovers = [
      ...(approvalLine.second || []),
      ...(approvalLine.third || []),
    ];
    const sharedUsers = approvalLine.shared || [];

    const allReferenceUsers = [
      ...new Set([...futureApprovers, ...sharedUsers]),
    ];

    allReferenceUsers.forEach((targetName: string) => {
      if (firstApprovers.includes(targetName)) return;

      const notiRef = db
        .collection("notifications")
        .doc(targetName)
        .collection("userNotifications")
        .doc();

      let message = "";

      if (futureApprovers.includes(targetName)) {
        // 1. 미래의 결재자인 경우 -> "예정" 알림
        message = `[공유/예정] ${docData.title}_${userName} 결재 요청이 도착했습니다.`;
      } else {
        // 2. 단순 공유자 -> "공유" 알림
        message = `[공유] ${docData.title}_${userName}`;
      }

      batch.set(notiRef, {
        targetUserName: targetName,
        fromUserName: userName,
        type: "approval",
        message: message,
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
