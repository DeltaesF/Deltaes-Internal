import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

type ApprovalHistoryEntry = {
  approver: string;
  status: string;
  approvedAt: Timestamp;
};

export async function POST(req: Request) {
  try {
    const { userName } = await req.json(); // 예: "정두원 책임"

    // 1. 오늘 날짜의 시작(00:00:00)과 끝(23:59:59) 계산
    const now = new Date();
    const today_start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const today_end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    // 2. 'lastApprovedAt'이 오늘인 모든 문서를 쿼리 (범위를 좁힘)
    // ❗ 이 쿼리는 Firestore 인덱스가 필요합니다. (아래 4번 항목 참고)
    const snapshot = await db
      .collectionGroup("requests")
      .where("lastApprovedAt", ">=", today_start)
      .where("lastApprovedAt", "<=", today_end)
      .get();

    let count = 0;

    // 3. JS로 필터링: 'approvalHistory'를 확인하여
    //    '누가'(approver) '오늘'(approvedAt) 승인했는지 확인
    snapshot.docs.forEach((doc) => {
      const data = doc.data();

      if (data.approvalHistory && Array.isArray(data.approvalHistory)) {
        const todayApproval = data.approvalHistory.find(
          (entry: ApprovalHistoryEntry) => {
            if (!entry.approvedAt) return false;

            const entryDate = entry.approvedAt.toDate();

            return (
              entry.approver === userName &&
              entryDate >= today_start &&
              entryDate <= today_end
            );
          }
        );

        if (todayApproval) {
          count++;
        }
      }
    });

    return NextResponse.json({ count });
  } catch (err) {
    console.error("결재 완료 건수 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
