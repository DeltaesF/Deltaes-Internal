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
      comment,

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

    // ✅ [추가] 로그: 요청 수신 확인
    console.log(
      `[Update API] 요청 수신: ID=${id}, User=${userName}, Status=${status}`
    );

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

    if (currentData?.userName !== userName) {
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

    // ✅ [추가] 코멘트 처리 (본문에 추가)
    if (comment) {
      const originalContent = content || currentData?.content || "";
      updateData.content = `${originalContent} <br/><br/> <p style="color:blue;">[결재의견] ${comment}</p>`;
    } else if (content) {
      // 코멘트가 없어도 수정된 content가 있으면 저장
      updateData.content = content;
    }

    // 공통 필드 업데이트
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (attachments) updateData.attachments = attachments;

    // ✅ [수정] 타입별 분기 처리 (undefined 체크 로직 추가 - 여기가 문제였음!)
    if (approvalType === "integrated_outside") {
      // [신규] 통합 외근/출장 업데이트
      if (workType !== undefined) updateData.workType = workType;
      if (transportType !== undefined) updateData.transportType = transportType;
      if (implementDate !== undefined) updateData.implementDate = implementDate;
      if (customerName !== undefined) updateData.customerName = customerName;
      if (customerDept !== undefined) updateData.customerDept = customerDept;
      if (customerEmail !== undefined) updateData.customerEmail = customerEmail;
      if (customerContact !== undefined)
        updateData.customerContact = customerContact;

      // null 허용 필드들은 undefined가 아닐 때만 할당 (null은 허용)
      if (usageDate !== undefined) updateData.usageDate = usageDate;
      if (tripPeriod !== undefined) updateData.tripPeriod = tripPeriod;
      if (vehicleModel !== undefined) updateData.vehicleModel = vehicleModel;
      if (transportCosts !== undefined)
        updateData.transportCosts = transportCosts;
      if (tripDestination !== undefined)
        updateData.tripDestination = tripDestination;
      if (tripCompanions !== undefined)
        updateData.tripCompanions = tripCompanions;
      if (tripExpenses !== undefined) updateData.tripExpenses = tripExpenses;
    } else if (approvalType === "purchase" || approvalType === "sales") {
      // [기존] 구매/판매 품의서 업데이트 (undefined 체크)
      if (serialNumber !== undefined) updateData.serialNumber = serialNumber;
      if (customerName !== undefined) updateData.customerName = customerName;
      if (product !== undefined) updateData.product = product;
      if (endUser !== undefined) updateData.endUser = endUser;
      if (customerInfo !== undefined) updateData.customerInfo = customerInfo;
      if (contractDate !== undefined) updateData.contractDate = contractDate;
      if (introductionType !== undefined)
        updateData.introductionType = introductionType;
      if (introductionMemo !== undefined)
        updateData.introductionMemo = introductionMemo;
      if (deliveryDate !== undefined) updateData.deliveryDate = deliveryDate;
      if (paymentPending !== undefined)
        updateData.paymentPending = paymentPending;
      if (paymentPendingAmount !== undefined)
        updateData.paymentPendingAmount = paymentPendingAmount;
      if (billingDate !== undefined) updateData.billingDate = billingDate;
      if (cashCollection !== undefined)
        updateData.cashCollection = cashCollection;
      if (cashCollectionDays !== undefined)
        updateData.cashCollectionDays = cashCollectionDays;
      if (collectionDate !== undefined)
        updateData.collectionDate = collectionDate;
      if (noteCollection !== undefined)
        updateData.noteCollection = noteCollection;
      if (noteCollectionDays !== undefined)
        updateData.noteCollectionDays = noteCollectionDays;
      if (noteMaturityDate !== undefined)
        updateData.noteMaturityDate = noteMaturityDate;
      if (specialNotes !== undefined) updateData.specialNotes = specialNotes;
      if (priceData !== undefined) updateData.priceData = priceData;
      if (costData !== undefined) updateData.costData = costData;

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

    // ✅ [추가] 로그: DB 업데이트 성공 확인
    console.log("[Update API] DB 업데이트 성공");

    // ----------------------------------------------------------------
    // [5] 🔔 결재 단계별 알림 및 이메일 발송 (상태 변경 시에만 실행)
    // ----------------------------------------------------------------
    if (status) {
      // ✅ [수정] 알림 로직 전체를 try-catch로 감싸서, 메일 실패 시에도 API는 성공으로 처리
      try {
        const batch = db.batch();
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

        const approvers = currentData?.approvers || {
          first: [],
          second: [],
          third: [],
        };
        const drafter = currentData?.userName;
        const docTitle = currentData?.title || title || "제목 없음";

        // ✅ [수정] 안전한 발송 함수 (개별 실패가 전체를 멈추지 않음)
        const safeNotifyAndEmail = async (
          targetUsers: string[],
          subject: string,
          message: string,
          link: string,
          isActionRequired: boolean,
          sendDbNotification: boolean,
          approvalComment?: string
        ) => {
          if (!targetUsers || targetUsers.length === 0) return;

          console.log(`[메일발송 시도] 대상: ${targetUsers.join(", ")}`);

          await Promise.all(
            targetUsers.map(async (targetName) => {
              try {
                // 1. DB 알림 (옵션)
                if (sendDbNotification) {
                  const notiRef = db
                    .collection("notifications")
                    .doc(targetName)
                    .collection("userNotifications")
                    .doc();

                  let erpMessage = `[${docTitle}] ${message}`;
                  if (approvalComment)
                    erpMessage += ` (의견: ${approvalComment})`;

                  batch.set(notiRef, {
                    targetUserName: targetName,
                    fromUserName: "ERP System",
                    type: "approval",
                    message: erpMessage,
                    link: link,
                    isRead: false,
                    createdAt: Date.now(),
                    approvalId: id,
                  });
                }

                // 2. 이메일 발송
                const userQuery = await db
                  .collection("employee")
                  .where("userName", "==", targetName)
                  .get();

                if (userQuery.empty) {
                  // ✅ [추가] 로그: 사용자 찾기 실패
                  console.warn(
                    `[메일실패] '${targetName}' 사용자를 찾을 수 없음`
                  );
                  return;
                }

                const email = userQuery.docs[0].data().email;

                if (!email) {
                  // ✅ [추가] 로그: 이메일 필드 없음
                  console.warn(
                    `[메일실패] '${targetName}'의 이메일 정보가 없음`
                  );
                  return;
                }

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

                // ✅ [추가] 로그: 발송 성공
                console.log(
                  `[메일성공] ${targetName} (${email})에게 발송 완료`
                );
              } catch (innerError) {
                // ✅ [추가] 로그: 개별 발송 에러 (여기서 잡아서 멈추지 않게 함)
                console.error(
                  `[메일에러] ${targetName} 발송 중 오류:`,
                  innerError
                );
              }
            })
          );
        };

        // 상태별 타겟 설정 및 발송 호출
        if (status.includes("2차 결재 대기") || status === "2차 결재 중") {
          await safeNotifyAndEmail(
            approvers.second,
            `[결재요청] 2차 결재가 필요합니다`,
            "2차 결재 차례입니다.",
            "/main/my-approval/pending",
            true,
            false,
            comment
          );
        } else if (
          status.includes("3차 결재 대기") ||
          status === "3차 결재 중"
        ) {
          await safeNotifyAndEmail(
            approvers.third,
            `[결재요청] 3차 결재가 필요합니다`,
            "3차 결재 차례입니다.",
            "/main/my-approval/pending",
            true,
            false,
            comment
          );
        } else if (status === "결재 완료" || status === "승인") {
          await safeNotifyAndEmail(
            [drafter],
            `[승인완료] ${docTitle}`,
            "결재가 최종 승인되었습니다.",
            `/main/workoutside/approvals/${id}`,
            false,
            true,
            comment
          );
        } else if (status.includes("반려")) {
          await safeNotifyAndEmail(
            [drafter],
            `[반려] ${docTitle}`,
            "결재가 반려되었습니다.",
            `/main/workoutside/approvals/${id}`,
            false,
            true,
            comment
          );
        }

        await batch.commit();
        console.log("[Update API] 알림 배치 커밋 완료");
      } catch (notifyError) {
        // ✅ [추가] 로그: 전체 알림 로직 에러 (DB 업데이트는 이미 되었으므로 성공 응답)
        console.error(
          "[알림시스템 에러] 알림 발송 실패 (DB 업데이트는 성공함):",
          notifyError
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval Update API Critical Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
