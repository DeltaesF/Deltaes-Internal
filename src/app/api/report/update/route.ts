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

// 업데이트할 데이터의 타입 정의
interface UpdatePayload {
  title: string;
  content: string;
  updatedAt: FieldValue;

  // 상태 변경용
  status?: string;

  // 교육 보고서 관련 필드
  educationName?: string;
  educationPeriod?: string;
  educationPlace?: string;
  educationTime?: string;
  usefulness?: string;

  tripDestination?: string;
  tripCompanions?: string;
  tripPeriod?: string;
  tripExpenses?: { date: string; detail: string }[];

  attachments?: { name: string; url: string }[];
  fileUrl?: string;
  fileName?: string;

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
    const {
      id,
      userName,

      approverName,

      // 상태 및 코멘트
      status,
      comment, // ✅ [확인] 여기서 받아서

      title,
      content,
      educationName,
      educationPeriod,
      educationPlace,
      educationTime,
      usefulness,
      tripDestination,
      tripCompanions,
      tripPeriod,
      tripExpenses,
      fileUrl,
      fileName,
      attachments,
    } = body;

    // ✅ 로그 추가
    console.log(
      `[Report Update] 요청 수신: ID=${id}, User=${userName}, Status=${status}`
    );

    if (!id || !userName || !title) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    // 보고서 경로 찾기
    const docRef = db
      .collection("reports")
      .doc(userName)
      .collection("userReports")
      .doc(id);

    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 작성자 본인 확인
    if (doc.data()?.userName !== userName) {
      return NextResponse.json(
        { error: "수정 권한이 없습니다." },
        { status: 403 }
      );
    }

    const currentData = doc.data();

    // UpdatePayload 타입 사용
    const updateData: UpdatePayload = {
      title,
      content,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 상태 변경이 있다면 업데이트에 포함
    if (status) {
      updateData.status = status;
    }

    // 코멘트
    if (content) updateData.content = content;

    // 값이 있는 경우에만 필드 추가 (undefined 체크)
    if (educationName !== undefined) updateData.educationName = educationName;
    if (educationPeriod !== undefined)
      updateData.educationPeriod = educationPeriod;
    if (educationPlace !== undefined)
      updateData.educationPlace = educationPlace;
    if (educationTime !== undefined) updateData.educationTime = educationTime;
    if (usefulness !== undefined) updateData.usefulness = usefulness;

    if (tripDestination !== undefined)
      updateData.tripDestination = tripDestination;
    if (tripCompanions !== undefined)
      updateData.tripCompanions = tripCompanions;
    if (tripPeriod !== undefined) updateData.tripPeriod = tripPeriod;
    if (tripExpenses !== undefined) updateData.tripExpenses = tripExpenses;

    // 파일 업데이트
    if (currentData?.reportType === "business_trip") {
      if (attachments !== undefined) {
        updateData.attachments = attachments;
      }
      if (fileUrl) {
        updateData.fileUrl = fileUrl;
        updateData.fileName = fileName;
      }
    }

    // ✅ [핵심 추가] 결재 이력(History) 저장 - 상태 텍스트 변환 로직
    if (status) {
      const finalApprover = approverName || "결재자";
      let historyStatus = status;

      // 문서의 다음 상태(status)를 보고 이력 멘트 결정
      if (status.includes("반려")) {
        historyStatus = "반려";
      } else if (status === "2차 결재 대기") {
        historyStatus = "1차 승인";
      } else if (status === "3차 결재 대기") {
        historyStatus = "2차 승인";
      } else if (
        status === "최종 승인 완료" ||
        status === "결재 완료" ||
        status === "승인"
      ) {
        historyStatus = "승인";
      }

      updateData.approvalHistory = FieldValue.arrayUnion({
        approver: finalApprover,
        status: historyStatus, // ✅ "1차 승인" 등으로 변환되어 저장
        comment: comment || "",
        approvedAt: new Date(),
      });
    }

    await docRef.update({ ...updateData });
    console.log("[Report Update] DB 업데이트 성공");

    // ----------------------------------------------------------------
    // [5] 🔔 알림 및 이메일 발송 (안전장치 적용)
    // ----------------------------------------------------------------
    if (status) {
      // ✅ [수정] try-catch로 감싸서 메일 실패해도 성공 응답
      try {
        const batch = db.batch();
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

        const approvers = currentData?.approvers || {
          first: [],
          second: [],
          third: [],
        };
        const drafter = currentData?.userName;
        const docTitle = title || currentData?.title || "제목 없음";

        // ✅ [수정] 안전한 발송 함수 (comment 인자 추가)
        const safeNotifyAndEmail = async (
          targetUsers: string[],
          subject: string,
          message: string,
          link: string,
          isActionRequired: boolean,
          sendDbNotification: boolean,
          approvalComment?: string // 👈 코멘트 받기
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

                  // 코멘트가 있으면 메시지에 추가
                  let erpMessage = `[${docTitle}] ${message}`;
                  if (approvalComment)
                    erpMessage += ` (의견: ${approvalComment})`;

                  batch.set(notiRef, {
                    targetUserName: targetName,
                    fromUserName: "ERP System",
                    type: "report",
                    message: erpMessage,
                    link: link,
                    isRead: false,
                    createdAt: Date.now(),
                    reportId: id,
                  });
                }

                // 2. 이메일 발송
                const userQuery = await db
                  .collection("employee")
                  .where("userName", "==", targetName)
                  .get();

                if (userQuery.empty) {
                  console.warn(`[메일실패] '${targetName}' 정보 없음`);
                  return;
                }
                const email = userQuery.docs[0].data().email;
                if (!email) {
                  console.warn(`[메일실패] '${targetName}' 이메일 없음`);
                  return;
                }

                await sendEmail({
                  to: email,
                  subject: subject,
                  html: `
                    <div style="padding: 20px; border: 1px solid #ddd; border-radius: 10px; font-family: sans-serif;">
                      <h2 style="color: #2c3e50;">${message}</h2>
                      <p><strong>보고서 제목:</strong> ${docTitle}</p>
                      <p><strong>작성자:</strong> ${drafter}</p>
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
                console.log(`[메일성공] ${targetName} (${email}) 발송 완료`);
              } catch (innerError) {
                console.error(
                  `[메일에러] ${targetName} 발송 중 오류:`,
                  innerError
                );
              }
            })
          );
        };

        // 🔄 상태별 타겟 설정 (comment 전달 추가)

        if (status.includes("2차 결재 대기") || status === "2차 결재 중") {
          await safeNotifyAndEmail(
            approvers.second,
            `[결재요청] 2차 결재가 필요합니다`,
            "2차 결재 차례입니다.",
            "/main/my-approval/pending",
            true,
            false,
            comment // 👈 전달
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
            comment // 👈 전달
          );
        } else if (status === "결재 완료" || status === "승인") {
          await safeNotifyAndEmail(
            [drafter],
            `[승인완료] ${docTitle}`,
            "보고서가 최종 승인되었습니다.",
            `/main/report/${id}`,
            false,
            true,
            comment // 👈 전달
          );
        } else if (status.includes("반려")) {
          await safeNotifyAndEmail(
            [drafter],
            `[반려] ${docTitle}`,
            "보고서가 반려되었습니다.",
            `/main/report/${id}`,
            false,
            true,
            comment // 👈 전달
          );
        }

        await batch.commit();
        console.log("[Report Update] 알림 배치 커밋 완료");
      } catch (notifyError) {
        console.error(
          "[알림시스템 에러] 알림 발송 실패 (DB 업데이트는 성공함):",
          notifyError
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Report Update Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
