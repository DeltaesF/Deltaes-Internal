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

    // [1] 병렬 쿼리: 내가 결재해야 할 문서 + 내가 신청한 대기 문서
    const queries = [
      // 1차 결재자 & 1차 대기
      ref
        .where("status", "==", "1차 결재 대기")
        .where("approvers.first", "array-contains", approverName),

      // 2차 결재자 & 2차 대기
      ref
        .where("status", "==", "2차 결재 대기")
        .where("approvers.second", "array-contains", approverName),

      // 3차 결재자 & 3차 대기
      ref
        .where("status", "==", "3차 결재 대기")
        .where("approvers.third", "array-contains", approverName),

      // 내가 신청한 문서 (상태 모니터링용)
      ref
        .where("userName", "==", approverName)
        .where("status", "in", [
          "1차 결재 대기",
          "2차 결재 대기",
          "3차 결재 대기",
        ]),
    ];

    // 쿼리 실행
    const snapshots = await Promise.all(queries.map((q) => q.get()));

    // [2] 데이터 병합 (중복 제거)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docsMap = new Map<string, any>();

    snapshots.forEach((snap) => {
      snap.docs.forEach((doc) => {
        const data = doc.data();

        // Timestamp 안전 변환
        const createdAtMillis =
          data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : typeof data.createdAt === "number"
            ? data.createdAt
            : Date.now(); // fallback

        docsMap.set(doc.id, {
          id: doc.id,
          ...data,
          createdAt: createdAtMillis,
          docType: "approval", // 구분용 태그
        });
      });
    });

    const list = Array.from(docsMap.values());

    // ✅ [핵심 수정] 생성일 기준 내림차순 정렬 (최신순)
    // b.createdAt - a.createdAt : 큰 값(최신)이 먼저 옴
    list.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ pending: list });
  } catch (error) {
    console.error("Error fetching approval pending list:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
