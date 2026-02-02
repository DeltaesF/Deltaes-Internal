import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { sendEmail } from "@/lib/nodemailer";

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

  // ✅ [추가] 상태 변경용
  status?: string;

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

      // ✅ [중요] 상태 변경 (결재 승인/반려 시)
      status,

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

    const currentData = doc.data();

    // 본인 확인 (이미 경로에 userName이 들어가지만 더블 체크)
    if (doc.data()?.userName !== userName) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    // 3. 업데이트 데이터 구성
    const updateData: UpdatePayload = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // ✅ 상태 변경이 있다면 업데이트에 포함
    if (status) {
      updateData.status = status;
    }

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

    // ----------------------------------------------------------------
    // [5] 🔔 결재 단계별 알림 및 이메일 발송 (상태 변경 시에만 실행)
    // ----------------------------------------------------------------
    if (status) {
      const batch = db.batch();
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      const approvers = currentData?.approvers || {
        first: [],
        second: [],
        third: [],
      };
      const drafter = currentData?.userName; // 기안자
      const docTitle = currentData?.title || title || "제목 없음";

      // ✅ 공통 알림/메일 발송 함수
      const notifyAndEmail = async (
        targetUsers: string[],
        subject: string,
        message: string,
        link: string,
        isActionRequired: boolean,
        sendDbNotification: boolean // 👈 DB 알림 여부 (결재자는 false, 기안자는 true)
      ) => {
        if (!targetUsers || targetUsers.length === 0) return;

        await Promise.all(
          targetUsers.map(async (targetName) => {
            // 1. DB 알림 저장 (옵션이 true일 때만)
            if (sendDbNotification) {
              const notiRef = db
                .collection("notifications")
                .doc(targetName)
                .collection("userNotifications")
                .doc();
              batch.set(notiRef, {
                targetUserName: targetName,
                fromUserName: "ERP System", // 또는 현재 결재자(userName)
                type: "approval",
                message: `[${docTitle}] ${message}`,
                link: link,
                isRead: false,
                createdAt: Date.now(),
                approvalId: id,
              });
            }

            // 2. 이메일 발송 (항상 수행)
            const userQuery = await db
              .collection("employee")
              .where("userName", "==", targetName)
              .get();
            if (!userQuery.empty) {
              const email = userQuery.docs[0].data().email;
              if (email) {
                await sendEmail({
                  to: email,
                  subject: subject,
                  html: `
                    <div style="padding: 20px; border: 1px solid #ddd; border-radius: 10px; font-family: sans-serif;">
                      <h2 style="color: #2c3e50;">${message}</h2>
                      <p><strong>문서 제목:</strong> ${docTitle}</p>
                      <p><strong>기안자:</strong> ${drafter}</p>
                      <br/>
                      <a href="${baseUrl}${link}" 
                         style="display: inline-block; padding: 12px 24px; background-color: #519d9e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                         ${isActionRequired ? "결재하러 가기" : "확인하기"}
                      </a>
                      <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;" />
                      <p style="font-size: 12px; color: #999;">본 메일은 델타이에스 ERP 시스템에서 자동 발송되었습니다.</p>
                    </div>
                  `,
                });
              }
            }
          })
        );
      };

      // 🔄 상태(Status)에 따른 타겟 설정

      // Case 1: 1차 승인됨 -> 2차 결재자에게 알림 (이메일 O, DB알림 X)
      if (status.includes("2차 결재 대기") || status === "2차 결재 중") {
        await notifyAndEmail(
          approvers.second,
          `[결재요청] 2차 결재가 필요합니다`,
          "2차 결재 차례입니다.",
          "/main/my-approval/pending",
          true,
          false // 👈 DB 알림 끔
        );
      }

      // Case 2: 2차 승인됨 -> 3차 결재자에게 알림 (이메일 O, DB알림 X)
      else if (status.includes("3차 결재 대기") || status === "3차 결재 중") {
        await notifyAndEmail(
          approvers.third,
          `[결재요청] 3차 결재가 필요합니다`,
          "3차 결재 차례입니다.",
          "/main/my-approval/pending",
          true,
          false // 👈 DB 알림 끔
        );
      }

      // Case 3: 최종 승인 -> 기안자에게 알림 (이메일 O, DB알림 O)
      else if (status === "결재 완료" || status === "승인") {
        await notifyAndEmail(
          [drafter],
          `[승인완료] ${docTitle}`,
          "결재가 최종 승인되었습니다.",
          `/main/workoutside/approvals/${id}`,
          false,
          true // 👈 DB 알림 켬 (결과 확인용)
        );
      }

      // Case 4: 반려 -> 기안자에게 알림 (이메일 O, DB알림 O)
      else if (status.includes("반려")) {
        await notifyAndEmail(
          [drafter],
          `[반려] ${docTitle}`,
          "결재가 반려되었습니다.",
          `/main/workoutside/approvals/${id}`,
          false,
          true // 👈 DB 알림 켬 (결과 확인용)
        );
      }

      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval Update Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
