import { db } from "@/lib/firebaseAdmin";
import { NextResponse } from "next/server";

type VacationType = {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  approvers: { first?: string[]; second?: string[] };
};

export async function POST(req: Request) {
  try {
    const { userName } = await req.json(); // 예: "정두원 프로"

    // ❗ 이 쿼리는 Firestore 인덱스가 필요합니다. (3단계 참고)
    const snapshot = await db
      .collectionGroup("requests")
      // 🔽 쿼리 조건을 'shared'로 변경합니다.
      .where("approvers.shared", "array-contains", userName)
      .get();

    const list: VacationType[] = [];

    snapshot.docs.forEach((doc) => {
      list.push({
        id: doc.id,
        ...(doc.data() as Omit<VacationType, "id">),
      });
    });

    // 'list'를 반환합니다. (count는 프론트에서 list.length로 계산)
    return NextResponse.json({ list });
  } catch (err) {
    console.error("공유 휴가 목록 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
