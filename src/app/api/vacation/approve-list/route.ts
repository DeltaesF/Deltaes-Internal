import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Individual.tsx의 VacationType과 유사하게 정의합니다.
type VacationType = {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  approvers: { first?: string[]; second?: string[] };
};

type ApprovalHistoryEntry = {
  approver: string;
  status: string;
  approvedAt: Timestamp;
};

export async function POST(req: Request) {
  try {
    const { userName } = await req.json(); // 예: "정두원 책임"

    // 1. 오늘 날짜 범위 계산 (동일)
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

    // 2. 쿼리 (동일)
    // ❗ (lastApprovedAt, 오름차순) 인덱스가 필요합니다.
    const snapshot = await db
      .collectionGroup("requests")
      .where("lastApprovedAt", ">=", today_start)
      .where("lastApprovedAt", "<=", today_end)
      .get();

    // 3. 'count' 대신 'list'를 생성합니다.
    const list: VacationType[] = [];

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
          // 4. count++ 대신 list에 문서를 추가합니다.
          list.push({
            id: doc.id,
            ...(data as Omit<VacationType, "id">), // 타입 캐스팅
          });
        }
      }
    });

    // 5. list를 반환합니다.
    return NextResponse.json({ list });
  } catch (err) {
    console.error("결재 완료 목록 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
