import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type ApprovalHistoryEntry = {
  approver: string;
  status: string;
  comment?: string; // ✅ 코멘트 필드 추가
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

export async function POST(req: Request) {
  try {
    // ✅ status(approve/reject), comment 추가 수신
    const { vacationId, approverName, applicantUserName, status, comment } =
      await req.json();

    if (!vacationId || !approverName || !applicantUserName) {
      return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });
    }

    const action = status === "reject" ? "reject" : "approve"; // action 구분

    const vacationRef = db
      .collection("vacation")
      .doc(applicantUserName)
      .collection("requests")
      .doc(vacationId);

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
        notificationTargets = [applicantUserName]; // 신청자에게 알림
        notiMessage = `[반려] ${approverName}님이 결재를 반려했습니다. 사유: ${
          comment || "없음"
        }`;
        historyStatus = "반려";
      }
      // ✅ [승인 로직] (기존 로직 유지)
      else {
        if (isFirst) {
          if (currentStatus !== "1차 결재 대기")
            throw new Error("순서가 아니거나 이미 처리되었습니다.");
          if (hasSecondApprover) {
            newStatus = "2차 결재 대기";
            notificationTargets = approvers.second || [];
            notiMessage = `[1차 승인] ${applicantUserName}님의 결재 요청 (2차 대기)`;
          } else if (hasThirdApprover) {
            newStatus = "3차 결재 대기";
            notificationTargets = approvers.third || [];
            notiMessage = `[1차 승인] ${applicantUserName}님의 결재 요청 (3차 대기)`;
          } else {
            newStatus = "최종 승인 완료";
            notificationTargets = approvers.shared || [];
            notiMessage = `[최종 승인] ${applicantUserName}님의 결재가 승인되었습니다.`;
          }
          historyStatus = "1차 승인";
        } else if (isSecond) {
          if (currentStatus !== "2차 결재 대기")
            throw new Error("순서가 아니거나 이미 처리되었습니다.");
          if (hasThirdApprover) {
            newStatus = "3차 결재 대기";
            notificationTargets = approvers.third || [];
            notiMessage = `[2차 승인] ${applicantUserName}님의 결재 요청 (3차 대기)`;
          } else {
            newStatus = "최종 승인 완료";
            notificationTargets = approvers.shared || [];
            notiMessage = `[최종 승인] ${applicantUserName}님의 결재가 승인되었습니다.`;
          }
          historyStatus = "2차 승인";
        } else if (isThird) {
          if (currentStatus !== "3차 결재 대기")
            throw new Error("순서가 아니거나 이미 처리되었습니다.");
          newStatus = "최종 승인 완료";
          notificationTargets = [
            applicantUserName,
            ...(approvers.shared || []),
          ];
          notiMessage = `[최종 승인] ${applicantUserName}님의 결재가 승인되었습니다.`;
          historyStatus = "최종 승인";
        } else {
          throw new Error("결재 권한이 없습니다.");
        }
      }

      // 1. 상태 및 이력 업데이트 (코멘트 포함)
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

      // 2. 최종 승인 시 휴가 일수 차감 (반려 시에는 차감 안 함)
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

      // 3. 알림 발송
      if (notificationTargets.length > 0) {
        notificationTargets.forEach((target) => {
          // 반려일 경우와 승인일 경우 링크 구분
          let link = "/main/my-approval/pending";
          let type = "vacation_request";

          if (action === "reject") {
            link = "/main/vacation/list"; // 반려되면 내 목록으로
            type = "vacation_reject";
          } else if (newStatus === "최종 승인 완료") {
            type = "vacation_complete";
            link =
              target === applicantUserName
                ? "/main/vacation/user"
                : "/main/my-approval/shared";
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
