import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { sendEmail } from "@/lib/nodemailer";

type ApprovalHistoryEntry = {
  approver: string;
  status: string;
  comment?: string;
  approvedAt: Date | FirebaseFirestore.Timestamp;
};

type VacationDoc = {
  approvers: {
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };
  status: string;
  userName: string;
  daysUsed: number;
  types?: string[];
  approvalHistory?: ApprovalHistoryEntry[];
};

// 이메일 발송 데이터 타입
type EmailTask = {
  targets: string[];
  subject: string;
  title: string;
  message: string;
  link: string;
  isAction: boolean;
};

export async function POST(req: Request) {
  try {
    const { vacationId, approverName, applicantUserName, status, comment } =
      await req.json();

    // ✅ 로그: 요청 수신
    console.log(
      `[Vacation Approve] 요청: ID=${vacationId}, Approver=${approverName}, Status=${status}`
    );

    if (!vacationId || !approverName || !applicantUserName) {
      return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });
    }

    const action = status === "reject" ? "reject" : "approve";

    const vacationRef = db
      .collection("vacation")
      .doc(applicantUserName)
      .collection("requests")
      .doc(vacationId);

    // 트랜잭션 밖에서 이메일 정보를 담을 변수
    let emailTask: EmailTask | null = null;

    // ----------------------------------------------------------------
    // 1. DB 트랜잭션 (상태 변경 & 휴가일수 차감)
    // ----------------------------------------------------------------
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(vacationRef);
      if (!doc.exists) throw new Error("문서를 찾을 수 없습니다.");

      const data = doc.data() as VacationDoc;
      const { approvers, status: currentStatus, daysUsed, types } = data;

      const isFirst = approvers.first?.includes(approverName);
      const isSecond = approvers.second?.includes(approverName);
      const isThird = approvers.third?.includes(approverName);

      const hasSecondApprover = approvers.second && approvers.second.length > 0;
      const hasThirdApprover = approvers.third && approvers.third.length > 0;

      let newStatus = currentStatus;
      let notificationTargets: string[] = [];
      let notiMessage = "";
      let historyStatus = "";

      // 🛑 [반려 로직]
      if (action === "reject") {
        newStatus = `반려됨 (${approverName})`;
        notificationTargets = [applicantUserName];
        notiMessage = `[반려] ${approverName}님이 결재를 반려했습니다. 사유: ${
          comment || "없음"
        }`;
        historyStatus = "반려";

        // 📧 이메일: 기안자에게 반려 통보
        emailTask = {
          targets: [applicantUserName],
          subject: `[반려] ${applicantUserName} - 휴가 신청`,
          title: "휴가 신청이 반려되었습니다.",
          message: `결재자(${approverName})님에 의해 반려되었습니다.<br/>사유: ${
            comment || "없음"
          }`,
          link: "/main/vacation/user",
          isAction: false,
        };
      }
      // ✅ [승인 로직]
      else {
        if (isFirst) {
          if (currentStatus !== "1차 결재 대기")
            throw new Error("순서가 아니거나 이미 처리되었습니다.");

          if (hasSecondApprover) {
            newStatus = "2차 결재 대기";
            notificationTargets = approvers.second || [];
            notiMessage = `[1차 승인] ${applicantUserName} 결재 요청 (2차 대기)`;

            emailTask = {
              targets: approvers.second || [],
              subject: `[결재요청] ${applicantUserName} - 휴가 신청`,
              title: "2차 결재가 필요합니다.",
              message: "다음 결재 차례입니다. 내용을 확인해주세요.",
              link: "/main/my-approval/pending",
              isAction: true,
            };
          } else if (hasThirdApprover) {
            newStatus = "3차 결재 대기";
            notificationTargets = approvers.third || [];
            notiMessage = `[1차 승인] ${applicantUserName} 결재 요청 (3차 대기)`;

            emailTask = {
              targets: approvers.third || [],
              subject: `[결재요청] ${applicantUserName} - 휴가 신청`,
              title: "3차 결재가 필요합니다.",
              message: "다음 결재 차례입니다. 내용을 확인해주세요.",
              link: "/main/my-approval/pending",
              isAction: true,
            };
          } else {
            newStatus = "최종 승인 완료";
            notificationTargets = approvers.shared || [];
            notiMessage = `[최종 승인] ${applicantUserName} 결재가 승인되었습니다.`;

            emailTask = {
              targets: [applicantUserName],
              subject: `[승인완료] ${applicantUserName} - 휴가 신청`,
              title: "휴가 신청이 최종 승인되었습니다.",
              message: "모든 결재가 완료되었습니다.",
              link: "/main/vacation/user",
              isAction: false,
            };
          }
          historyStatus = "1차 승인";
        } else if (isSecond) {
          if (currentStatus !== "2차 결재 대기")
            throw new Error("순서가 아니거나 이미 처리되었습니다.");

          if (hasThirdApprover) {
            newStatus = "3차 결재 대기";
            notificationTargets = approvers.third || [];
            notiMessage = `[2차 승인] ${applicantUserName} 결재 요청 (3차 대기)`;

            emailTask = {
              targets: approvers.third || [],
              subject: `[결재요청] ${applicantUserName} - 휴가 신청`,
              title: "3차 결재가 필요합니다.",
              message: "다음 결재 차례입니다. 내용을 확인해주세요.",
              link: "/main/my-approval/pending",
              isAction: true,
            };
          } else {
            newStatus = "최종 승인 완료";
            notificationTargets = approvers.shared || [];
            notiMessage = `[최종 승인] ${applicantUserName} 결재가 승인되었습니다.`;

            emailTask = {
              targets: [applicantUserName],
              subject: `[승인완료] ${applicantUserName} - 휴가 신청`,
              title: "휴가 신청이 최종 승인되었습니다.",
              message: "모든 결재가 완료되었습니다.",
              link: "/main/vacation/user",
              isAction: false,
            };
          }
          historyStatus = "2차 승인";
        } else if (isThird) {
          if (currentStatus !== "3차 결재 대기")
            throw new Error("순서가 아니거나 이미 처리되었습니다.");

          newStatus = "최종 승인 완료";
          notificationTargets = [applicantUserName];
          notiMessage = `[최종 승인] ${applicantUserName} 결재가 승인되었습니다.`;

          emailTask = {
            targets: [applicantUserName],
            subject: `[승인완료] ${applicantUserName} - 휴가 신청`,
            title: "휴가 신청이 최종 승인되었습니다.",
            message: "모든 결재가 완료되었습니다.",
            link: "/main/vacation/user",
            isAction: false,
          };
          historyStatus = "최종 승인";
        } else {
          throw new Error("결재 권한이 없습니다.");
        }
      }

      // DB 업데이트
      transaction.update(vacationRef, {
        status: newStatus,
        lastApprovedAt: new Date(),
        approvalHistory: FieldValue.arrayUnion({
          approver: approverName,
          status: historyStatus,
          comment: comment || "", // ✅ 코멘트 저장
          approvedAt: new Date(),
        }),
      });

      // 최종 승인 시 휴가 차감
      if (newStatus === "최종 승인 완료") {
        let deductibleDays = 0;
        if (types && Array.isArray(types) && types.length > 0) {
          deductibleDays = types.reduce((sum, type) => {
            if (type.includes("반차")) return sum + 0.5;
            if (type === "공가") return sum + 0;
            return sum + 1;
          }, 0);
        } else {
          deductibleDays = daysUsed;
        }

        const empRef = db.collection("employee").doc(applicantUserName);
        transaction.update(empRef, {
          usedVacation: FieldValue.increment(deductibleDays),
          remainingVacation: FieldValue.increment(-deductibleDays),
        });
      }

      // DB 알림 저장
      if (notificationTargets.length > 0) {
        notificationTargets.forEach((target) => {
          let link = "/main/my-approval/pending";
          let type = "vacation_request";

          if (action === "reject") {
            link = "/main/vacation/user";
            type = "vacation_reject";
          } else if (newStatus === "최종 승인 완료") {
            type = "vacation_complete";
            link = "/main/vacation/user";
          }

          const notiRef = db
            .collection("notifications")
            .doc(target)
            .collection("userNotifications")
            .doc();

          transaction.set(notiRef, {
            targetUserName: target,
            fromUserName: approverName,
            type: type,
            message: notiMessage,
            link: link,
            isRead: false,
            createdAt: Date.now(),
            vacationId: vacationId,
          });
        });
      }
    });

    // ✅ 로그: DB 업데이트 성공
    console.log("[Vacation Approve] DB 트랜잭션 성공");

    // ----------------------------------------------------------------
    // 2. 이메일 발송 (안전장치 try-catch 적용)
    // ----------------------------------------------------------------
    if (emailTask) {
      try {
        const task = emailTask as EmailTask;
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

        // 이메일 주소 찾기
        const emails: string[] = [];
        const userSnapshots = await Promise.all(
          task.targets.map((name) =>
            db.collection("employee").where("userName", "==", name).get()
          )
        );

        userSnapshots.forEach((snap, idx) => {
          if (!snap.empty) {
            const email = snap.docs[0].data().email;
            if (email) {
              emails.push(email);
            } else {
              console.warn(`[메일경고] ${task.targets[idx]}의 이메일 없음`);
            }
          } else {
            console.warn(`[메일경고] ${task.targets[idx]} 사용자 정보 없음`);
          }
        });

        if (emails.length > 0) {
          console.log(`[메일발송 시도] 대상: ${emails.join(", ")}`);

          await Promise.all(
            emails.map((email) =>
              sendEmail({
                to: email,
                subject: task.subject,
                html: `
                  <div style="padding: 20px; border: 1px solid #ddd; border-radius: 10px; font-family: sans-serif;">
                    <h2 style="color: #2c3e50;">${task.title}</h2>
                    <p style="font-size: 16px; line-height: 1.5;">${
                      task.message
                    }</p>
                    <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                      <p style="margin: 5px 0;"><strong>신청자:</strong> ${applicantUserName}</p>
                      <p style="margin: 5px 0;"><strong>처리자:</strong> ${approverName}</p>
                    </div>
                    <a href="${baseUrl}${task.link}" 
                      style="display: inline-block; padding: 12px 24px; background-color: #519d9e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">
                      ${task.isAction ? "결재하러 가기" : "확인하기"}
                    </a>
                  </div>
                `,
              })
            )
          );
          console.log("[Vacation Approve] 메일 발송 완료");
        }
      } catch (emailError) {
        // 🚨 중요: 메일 발송 에러가 나도 API는 성공으로 처리해야 함 (DB는 이미 업데이트됨)
        console.error(
          "[Vacation Approve] 메일 발송 실패 (DB는 성공):",
          emailError
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Vacation Approve API Error]:", err);
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
