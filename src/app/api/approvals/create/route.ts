import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { sendEmail } from "@/lib/nodemailer";

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

// ✅ [추가] 결재선 구조 정의
interface ApproverStructure {
  first: string[];
  second: string[];
  third: string[];
  shared: string[];
}

// ✅ [추가] 결재 이력 구조 정의
interface ApprovalHistoryEntry {
  approver: string;
  status: string;
  comment: string;
  approvedAt: Date | FieldValue;
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

  // 방문고객 상세정보
  customerName?: string;
  customerDept?: string;
  customerEmail?: string;
  customerContact?: string;

  // 기간
  usageDate?: string | null;
  tripPeriod?: string | null;

  // 조건부
  vehicleModel?: string | null;
  usagePeriod?: string | null;
  transportCosts?: TransportCosts | null;

  // 출장용
  tripDestination?: string | null;
  tripCompanions?: string | null;
  tripExpenses?: ExpenseItem[];

  // 구매/판매용
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

  // ✅ [수정 1] any 제거 -> 배열이거나 객체 구조임
  approvers?: string[] | ApproverStructure;
}

interface ApprovalDocData extends Partial<CreateRequestBody> {
  department: string;
  approvers: ApproverStructure;
  status: string;
  createdAt: number | FieldValue;
  resultReport?: string;
  // ✅ [수정 3] any[] 제거 -> 명확한 이력 타입 사용
  approvalHistory: ApprovalHistoryEntry[];
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
      approvers: bodyApprovers,
    } = body;

    if (!userName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. 직원 정보(결재선) 조회
    // ✅ [수정 2] any 제거 -> 배열 혹은 객체, 혹은 undefined
    let rawApprovers: string[] | ApproverStructure | undefined = bodyApprovers;
    let department = "";

    if (!rawApprovers) {
      const employeeQuery = await db
        .collection("employee")
        .where("userName", "==", userName)
        .get();

      if (!employeeQuery.empty) {
        const empData = employeeQuery.docs[0].data();
        // DB에서 가져온 데이터는 타입 단언(as)을 통해 구조를 맞춰줍니다.
        rawApprovers = empData.recipients?.approval as
          | string[]
          | ApproverStructure
          | undefined;
        department = empData.department || "";
      }
    }

    // 결재선 데이터 구조 정규화 (배열 -> 객체 변환)
    const structuredApprovers: ApproverStructure = {
      first: [],
      second: [],
      third: [],
      shared: [],
    };

    if (Array.isArray(rawApprovers)) {
      // 배열인 경우: 인덱스 순서대로 1, 2, 3차 배정
      if (rawApprovers[0]) structuredApprovers.first = [rawApprovers[0]];
      if (rawApprovers[1]) structuredApprovers.second = [rawApprovers[1]];
      if (rawApprovers[2]) structuredApprovers.third = [rawApprovers[2]];
    } else if (rawApprovers && typeof rawApprovers === "object") {
      // 객체인 경우: 그대로 매핑 (타입 가드 통과 후 할당)
      const ra = rawApprovers as ApproverStructure;
      if (ra.first) structuredApprovers.first = ra.first;
      if (ra.second) structuredApprovers.second = ra.second;
      if (ra.third) structuredApprovers.third = ra.third;
      if (ra.shared) structuredApprovers.shared = ra.shared;
    }

    // 2. 기본 데이터 구성
    const docData: ApprovalDocData = {
      approvalType,
      title: title || `[결재] ${userName}`,
      content: content || "",
      userName,
      department,
      approvers: structuredApprovers,
      status: "1차 결재 대기",
      createdAt: createdAt || FieldValue.serverTimestamp(),
      attachments: attachments || [],
      resultReport: "",
      approvalHistory: [], // 초기화
    };

    // 3. 타입별 데이터 병합
    if (approvalType === "integrated_outside") {
      docData.workType = body.workType;
      docData.transportType = body.transportType;
      docData.implementDate = body.implementDate;

      docData.customerName = body.customerName;
      docData.customerDept = body.customerDept;
      docData.customerEmail = body.customerEmail;
      docData.customerContact = body.customerContact;

      docData.usageDate = body.usageDate ?? null;
      docData.tripPeriod = body.tripPeriod ?? null;

      docData.vehicleModel = body.vehicleModel ?? null;
      docData.transportCosts = body.transportCosts ?? null;

      docData.tripDestination = body.tripDestination ?? null;
      docData.tripCompanions = body.tripCompanions ?? null;
      docData.tripExpenses = body.tripExpenses || [];
    } else if (approvalType === "purchase" || approvalType === "sales") {
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
        }품의] ${body.customerName || ""}_${body.product || ""}`;
    }

    // 4. DB 저장
    const docRef = db
      .collection("approvals")
      .doc(userName)
      .collection("userApprovals")
      .doc();

    const cleanDocData = JSON.parse(JSON.stringify(docData));
    await docRef.set(cleanDocData);

    // 5. 알림 발송
    const batch = db.batch();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const detailPath = `/main/workoutside/approvals/${docRef.id}`;

    const notifyGroup = async (
      targetUsers: string[],
      mailSubject: string,
      mailHeader: string,
      mailMessage: string,
      linkPath: string,
      isApprovalRequest: boolean,
      sendDbNotification: boolean
    ) => {
      if (!targetUsers || targetUsers.length === 0) return;

      await Promise.all(
        targetUsers.map(async (targetName) => {
          if (sendDbNotification) {
            const notiRef = db
              .collection("notifications")
              .doc(targetName)
              .collection("userNotifications")
              .doc();
            batch.set(notiRef, {
              targetUserName: targetName,
              fromUserName: userName,
              type: "approval",
              message: `[${docData.title}] ${mailHeader}`,
              link: isApprovalRequest ? "/main/my-approval/pending" : linkPath,
              isRead: false,
              createdAt: Date.now(),
              approvalId: docRef.id,
            });
          }

          const userQuery = await db
            .collection("employee")
            .where("userName", "==", targetName)
            .get();
          if (!userQuery.empty) {
            const email = userQuery.docs[0].data().email;
            if (email) {
              await sendEmail({
                to: email,
                subject: mailSubject,
                html: `
                  <div style="padding: 20px; border: 1px solid #ddd; border-radius: 10px; font-family: sans-serif;">
                    <h2 style="color: #2c3e50;">${mailHeader}</h2>
                    <p style="font-size: 16px; line-height: 1.5;">${mailMessage}</p>
                    <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                      <p style="margin: 5px 0;"><strong>기안자:</strong> ${userName} (${department})</p>
                      <p style="margin: 5px 0;"><strong>제목:</strong> ${
                        docData.title
                      }</p>
                    </div>
                    <a href="${baseUrl}${linkPath}" 
                       style="display: inline-block; padding: 12px 24px; background-color: #519d9e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">
                       ${isApprovalRequest ? "결재하러 가기" : "문서 확인하기"}
                    </a>
                  </div>
                `,
              });
            }
          }
        })
      );
    };

    // [A] 1차 결재자 알림
    await notifyGroup(
      structuredApprovers.first,
      `[결재요청] ${docData.title}`,
      "1차 결재 요청이 도착했습니다.",
      `${userName} 작성한 문서의 1차 결재 차례입니다.`,
      "/main/my-approval/pending",
      true,
      true
    );

    // [B] 공유자 알림
    const allApprovers = structuredApprovers.first;
    const sharedUsers = [
      ...structuredApprovers.second,
      ...structuredApprovers.third,
      ...structuredApprovers.shared,
    ].filter((user) => !allApprovers.includes(user));

    const uniqueSharedUsers = [...new Set(sharedUsers)];

    await notifyGroup(
      uniqueSharedUsers,
      `[공유] ${docData.title}`,
      "문서가 공유되었습니다.",
      `${userName} 작성한 문서가 공유되었습니다.`,
      detailPath,
      false,
      true
    );

    await batch.commit();
    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error("Create Error:", error);
    const msg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
