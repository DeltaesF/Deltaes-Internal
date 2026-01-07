import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type ApprovalHistoryEntry = {
  approver: string;
  status: string;
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
  approvalHistory?: ApprovalHistoryEntry[];
};

export async function POST(req: Request) {
  try {
    const { vacationId, approverName, applicantUserName } = await req.json();

    if (!vacationId || !approverName || !applicantUserName) {
      return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });
    }

    const vacationRef = db
      .collection("vacation")
      .doc(applicantUserName)
      .collection("requests")
      .doc(vacationId);

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(vacationRef);
      if (!doc.exists) throw new Error("문서를 찾을 수 없습니다.");

      const data = doc.data() as VacationDoc;
      const { approvers, status, daysUsed } = data;

      const isFirst = approvers.first?.includes(approverName);
      const isSecond = approvers.second?.includes(approverName);
      const isThird = approvers.third?.includes(approverName);

      // 다음 결재자가 존재하는지 확인하는 헬퍼 변수
      const hasSecondApprover = approvers.second && approvers.second.length > 0;
      const hasThirdApprover = approvers.third && approvers.third.length > 0;

      let newStatus = status;
      let notificationTargets: string[] = [];
      let notiMessage = "";
      let historyStatus = "";

      // =========================================================
      // [CASE 1] 1차 결재자 승인
      // =========================================================
      if (isFirst) {
        if (status !== "1차 결재 대기")
          throw new Error("순서가 아니거나 이미 처리되었습니다.");

        // 🚀 다음 단계 결정 로직 (건너뛰기 포함)
        if (hasSecondApprover) {
          newStatus = "2차 결재 대기";
          notificationTargets = approvers.second || [];
          notiMessage = `[1차 승인] ${applicantUserName} 휴가, 2차 결재 부탁드립니다.`;
        } else if (hasThirdApprover) {
          newStatus = "3차 결재 대기"; // 2차 없으면 바로 3차로
          notificationTargets = approvers.third || [];
          notiMessage = `[1차 승인] ${applicantUserName} 휴가, 3차(최종) 결재 부탁드립니다.`;
        } else {
          newStatus = "최종 승인 완료"; // 2, 3차 다 없으면 바로 최종
          notificationTargets = approvers.shared || [];
          notiMessage = `[최종 승인] ${applicantUserName} 휴가가 승인되었습니다 (1차 전결).`;
        }
        historyStatus = "1차 승인";
      }
      // =========================================================
      // [CASE 2] 2차 결재자 승인
      // =========================================================
      else if (isSecond) {
        if (status !== "2차 결재 대기")
          throw new Error("이전 결재가 완료되지 않았습니다.");

        // 🚀 다음 단계 결정 로직
        if (hasThirdApprover) {
          newStatus = "3차 결재 대기";
          notificationTargets = approvers.third || [];
          notiMessage = `[2차 승인] ${applicantUserName} 휴가, 3차(최종) 결재 부탁드립니다.`;
        } else {
          newStatus = "최종 승인 완료"; // 3차 없으면 바로 최종
          notificationTargets = approvers.shared || [];
          notiMessage = `[최종 승인] ${applicantUserName} 휴가가 승인되었습니다 (2차 전결).`;
        }
        historyStatus = "2차 승인";
      }
      // =========================================================
      // [CASE 3] 3차 결재자 승인 (무조건 최종)
      // =========================================================
      else if (isThird) {
        if (status !== "3차 결재 대기")
          throw new Error("이전 결재가 완료되지 않았습니다.");

        newStatus = "최종 승인 완료";
        notificationTargets = [applicantUserName, ...(approvers.shared || [])];
        notiMessage = `[최종 승인] ${applicantUserName} 휴가가 승인되었습니다.`;
        historyStatus = "최종 승인";
      } else {
        throw new Error("결재 권한이 없습니다.");
      }

      // 1. 상태 및 이력 업데이트
      transaction.update(vacationRef, {
        status: newStatus,
        lastApprovedAt: new Date(),
        approvalHistory: FieldValue.arrayUnion({
          approver: approverName,
          status: historyStatus,
          approvedAt: new Date(),
        }),
      });

      // 2. 최종 승인 시 휴가 일수 차감
      if (newStatus === "최종 승인 완료") {
        const empRef = db.collection("employee").doc(applicantUserName);
        transaction.update(empRef, {
          usedVacation: FieldValue.increment(daysUsed),
          remainingVacation: FieldValue.increment(-daysUsed),
        });
      }

      // 3. 알림 발송
      if (notificationTargets.length > 0) {
        notificationTargets.forEach((target) => {
          let link = "/main/my-approval/pending"; // 기본: 결재 대기함
          let type = "vacation_request"; // 기본: 요청

          // 최종 승인 알림인 경우
          if (newStatus === "최종 승인 완료") {
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
