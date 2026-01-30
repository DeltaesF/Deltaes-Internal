import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type ApprovalHistoryEntry = {
  approver: string;
  status: string;
  comment?: string;
  approvedAt: Date | FirebaseFirestore.Timestamp;
};

type ApprovalDoc = {
  approvers: {
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };
  status: string;
  title: string;
  approvalHistory?: ApprovalHistoryEntry[];
};

export async function POST(req: Request) {
  try {
    const { approvalId, approverName, applicantUserName, status, comment } =
      await req.json();

    if (!approvalId || !approverName || !applicantUserName) {
      return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });
    }

    const action = status === "reject" ? "reject" : "approve";

    const docRef = db
      .collection("approvals")
      .doc(applicantUserName)
      .collection("userApprovals")
      .doc(approvalId);

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) throw new Error("문서를 찾을 수 없습니다.");

      const data = doc.data() as ApprovalDoc;
      const { approvers, status: currentStatus, title } = data;

      const isFirst = approvers.first?.includes(approverName);
      const isSecond = approvers.second?.includes(approverName);
      const isThird = approvers.third?.includes(approverName);

      const hasSecondApprover = approvers.second && approvers.second.length > 0;
      const hasThirdApprover = approvers.third && approvers.third.length > 0;

      let newStatus = currentStatus;
      let notificationTargets: string[] = [];
      let notiMessage = "";
      let historyStatus = "";

      // 1️⃣ [반려]
      if (action === "reject") {
        newStatus = `반려됨 (${approverName})`;
        notificationTargets = [applicantUserName];
        // ✅ [수정] 반려 메시지에도 제목 포함
        notiMessage = `[품의서 반려] ${title}_${approverName}님이 결재를 반려했습니다.`;
        historyStatus = "반려";
      }
      // 2️⃣ [승인]
      else {
        if (isFirst) {
          if (currentStatus !== "1차 결재 대기") throw new Error("순서 오류");
          if (hasSecondApprover) {
            newStatus = "2차 결재 대기";
            notificationTargets = approvers.second || [];
            // ✅ [수정] 2차 결재자에게 보낼 메시지 (제목 포함)
            notiMessage = `[품의서/2차결재] ${title}_${applicantUserName} 결재 요청이 도착했습니다.`;
          } else if (hasThirdApprover) {
            newStatus = "3차 결재 대기";
            notificationTargets = approvers.third || [];
            // ✅ [수정] 3차 결재자에게 보낼 메시지 (제목 포함)
            notiMessage = `[품의서/3차결재] ${title}_${applicantUserName} 결재 요청이 도착했습니다.`;
          } else {
            newStatus = "최종 승인 완료";
            notificationTargets = [
              applicantUserName,
              ...(approvers.shared || []),
            ];
            notiMessage = `[품의서/완료] ${title} 결재가 완료되었습니다.`;
          }
          historyStatus = "1차 승인";
        } else if (isSecond) {
          if (currentStatus !== "2차 결재 대기") throw new Error("순서 오류");
          if (hasThirdApprover) {
            newStatus = "3차 결재 대기";
            notificationTargets = approvers.third || [];
            // ✅ [수정] 3차 결재자에게 보낼 메시지 (제목 포함)
            notiMessage = `[품의서/3차결재] ${title}_${applicantUserName} 결재 요청이 도착했습니다.`;
          } else {
            newStatus = "최종 승인 완료";
            notificationTargets = [
              applicantUserName,
              ...(approvers.shared || []),
            ];
            notiMessage = `[품의서/완료] ${title} 결재가 완료되었습니다.`;
          }
          historyStatus = "2차 승인";
        } else if (isThird) {
          if (currentStatus !== "3차 결재 대기") throw new Error("순서 오류");
          newStatus = "최종 승인 완료";
          notificationTargets = [
            applicantUserName,
            ...(approvers.shared || []),
          ];
          notiMessage = `[품의서/완료] ${title} 결재가 완료되었습니다.`;
          historyStatus = "최종 승인";
        } else {
          throw new Error("결재 권한 없음");
        }
      }

      // 3️⃣ 업데이트
      transaction.update(docRef, {
        status: newStatus,
        approvalHistory: FieldValue.arrayUnion({
          approver: approverName,
          status: historyStatus,
          comment: comment || "",
          approvedAt: new Date(),
        }),
      });

      // 4️⃣ 알림 발송 (수정된 로직)
      if (notificationTargets.length > 0) {
        // ✅ 메시지에 코멘트가 있다면 추가해주는 로직
        const commentSuffix = comment ? ` (의견: ${comment})` : "";
        const finalNotiMessage = `${notiMessage}${commentSuffix}`;

        notificationTargets.forEach((target) => {
          let link = "/main/my-approval/pending";

          // 완료되거나 반려된 경우 상세/공유 페이지로 이동
          if (newStatus === "최종 승인 완료" || newStatus.includes("반려")) {
            link =
              target === applicantUserName
                ? `/main/workoutside/approvals/${approvalId}`
                : `/main/my-approval/shared`;
          }

          const notiRef = db
            .collection("notifications")
            .doc(target)
            .collection("userNotifications")
            .doc();

          transaction.set(notiRef, {
            targetUserName: target,
            fromUserName: approverName,
            type: "approval",
            // ✅ 수정된 finalNotiMessage를 사용합니다.
            message: finalNotiMessage,
            link,
            isRead: false,
            createdAt: Date.now(),
            approvalId: approvalId,
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
