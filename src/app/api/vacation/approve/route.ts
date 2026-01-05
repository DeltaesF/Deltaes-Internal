import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// ✅ 1. 타입 정의
type ApprovalHistoryEntry = {
  approver: string;
  status: string;
  approvedAt: Date | FirebaseFirestore.Timestamp;
};

type VacationDoc = {
  approvers: {
    first?: string[];
    second?: string[];
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

      // 타입 단언
      const data = doc.data() as VacationDoc;
      const { approvers, status, daysUsed } = data;

      const isFirst = approvers.first?.includes(approverName);
      const isSecond = approvers.second?.includes(approverName);

      let newStatus = status;
      let notificationTargets: string[] = [];
      let notiMessage = "";
      let historyStatus = "";

      // =========================================================
      // [로직 1] 1차 결재자 승인 시 (전원 합의 체크)
      // =========================================================
      if (isFirst) {
        if (status !== "1차 결재 대기")
          throw new Error("이미 처리되었거나 1차 결재 단계가 아닙니다.");

        // 1. 기존에 승인한 1차 결재자들 목록 추출
        const previousFirstApprovals = (data.approvalHistory || [])
          .filter((h) => approvers.first?.includes(h.approver))
          .map((h) => h.approver);

        // 2. 현재 승인자 포함, 승인한 모든 사람 집합 생성
        const allApprovedFirst = new Set([
          ...previousFirstApprovals,
          approverName,
        ]);

        // 3. 1차 결재자 '전원'이 승인했는지 확인 (every)
        const isAllFirstApproved = approvers.first!.every((name) =>
          allApprovedFirst.has(name)
        );

        if (isAllFirstApproved) {
          // ✅ 전원 승인 완료 -> 다음 단계로 진행

          if (approvers.second && approvers.second.length > 0) {
            newStatus = "2차 결재 대기";
            historyStatus = "1차 승인 완료 (전원)";
            notificationTargets = approvers.second; // 2차 결재자에게 알림
            notiMessage = `[1차 완료] ${applicantUserName}님의 휴가 결재를 진행해주세요.`;
          } else {
            // 2차 없음 -> 최종 승인
            newStatus = "최종 승인 완료";
            historyStatus = "최종 승인 (1차 전결)";
            notificationTargets = approvers.shared || [];
            notiMessage = `[휴가 승인] ${applicantUserName}님의 휴가가 최종 승인되었습니다.`;
          }
        } else {
          // ⏳ 아직 승인 안 한 1차 결재자가 있음 -> 상태 유지
          newStatus = "1차 결재 대기";
          historyStatus = "1차 승인 (진행중)";

          // 알림: 신청자에게만 "OOO님이 승인했습니다(아직 대기중)" 알림 (선택사항)
          notificationTargets = [applicantUserName];
          notiMessage = `[결재 진행] ${approverName}님이 1차 결재를 승인했습니다. (타 결재자 대기중)`;
        }
      }
      // =========================================================
      // [로직 2] 2차 결재자 승인 시
      // =========================================================
      else if (isSecond) {
        if (status !== "2차 결재 대기")
          throw new Error("1차 결재가 완료되지 않았습니다.");

        newStatus = "최종 승인 완료";
        historyStatus = "최종 승인";
        // 본인 + 공유자들에게 알림
        notificationTargets = [applicantUserName, ...(approvers.shared || [])];
        notiMessage = `[휴가 승인] ${applicantUserName}님의 휴가가 최종 승인되었습니다.`;
      } else {
        throw new Error("결재 권한이 없습니다.");
      }

      // 1. 상태 업데이트 및 이력 저장
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
          let link = "/main/my-approval/shared";

          if (target === applicantUserName) link = "/main/vacation/user";
          if (isFirst && newStatus === "2차 결재 대기")
            link = "/main/my-approval/pending";

          const notiRef = db
            .collection("notifications")
            .doc(target)
            .collection("userNotifications")
            .doc();

          transaction.set(notiRef, {
            targetUserName: target,
            fromUserName: approverName,
            type: "vacation_complete",
            message: notiMessage,
            link: link,
            isRead: false,
            createdAt: Date.now(),
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
