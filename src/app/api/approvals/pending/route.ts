import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const { approverName } = await req.json();

    if (!approverName) {
      return NextResponse.json({ pending: [] });
    }

    const ref = db.collectionGroup("userApprovals");

    // ✅ [핵심 수정] 대상자별로 보는 기준을 다르게 설정 (하이브리드 방식)
    const queries = [
      // ---------------------------------------------------------
      // [1] 1차 결재자: 엄격 모드 (내 차례인 '1차 대기'일 때만 보임)
      // -> 승인하면 '2차 대기'가 되므로 목록에서 즉시 사라짐
      // ---------------------------------------------------------
      ref
        .where("approvers.first", "array-contains", approverName)
        .where("status", "==", "1차 결재 대기"),

      // ---------------------------------------------------------
      // [2] 2차 결재자: 엄격 모드 (내 차례인 '2차 대기'일 때만 보임)
      // -> 승인하면 '3차 대기'가 되므로 목록에서 즉시 사라짐
      // ---------------------------------------------------------
      ref
        .where("approvers.second", "array-contains", approverName)
        .where("status", "==", "2차 결재 대기"),

      // ---------------------------------------------------------
      // [3] 3차 결재자: 관전 모드 (1차, 2차, 3차 대기 모두 보임)
      // -> 요청하신 대로 미리 볼 수 있음.
      // -> 단, '최종 승인 완료'는 리스트에 없으므로, 최종 승인 시 사라짐
      // ---------------------------------------------------------
      ref
        .where("approvers.third", "array-contains", approverName)
        .where("status", "in", [
          "1차 결재 대기",
          "2차 결재 대기",
          "3차 결재 대기",
        ]),

      // ---------------------------------------------------------
      // [4] (옵션) 기안자 본인: 내가 올린 건이 진행 중이면 보기
      // -> 필요 없다면 이 부분은 주석 처리 하셔도 됩니다.
      // ---------------------------------------------------------
      ref
        .where("userName", "==", approverName)
        .where("status", "in", [
          "1차 결재 대기",
          "2차 결재 대기",
          "3차 결재 대기",
        ]),
    ];

    // 쿼리 병렬 실행
    const snapshots = await Promise.all(queries.map((q) => q.get()));

    // 데이터 병합 (중복 제거)
    // 3차 결재자가 동시에 1차 결재자일 수도 있는 예외 상황 등을 대비해 Map으로 중복 제거
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docsMap = new Map<string, any>();

    snapshots.forEach((snap) => {
      snap.docs.forEach((doc) => {
        const data = doc.data();

        const createdAtMillis =
          data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : typeof data.createdAt === "number"
            ? data.createdAt
            : Date.now();

        docsMap.set(doc.id, {
          id: doc.id,
          ...data,
          createdAt: createdAtMillis,
          docType: "approval",
        });
      });
    });

    const list = Array.from(docsMap.values());

    // 최신순 정렬
    list.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ pending: list });
  } catch (error) {
    console.error("Error fetching approval pending list:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
