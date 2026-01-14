import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// ✅ 1. 타입 정의 (any 제거)
interface ReportDoc {
  id: string;
  userName: string;
  title: string;
  content: string;
  status: string;
  reportType: string;
  approvers: {
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };
  createdAt: number;
  docType: "report"; // 클라이언트에서 구분하기 위한 태그
}

export async function POST(req: Request) {
  try {
    const { approverName } = await req.json();

    if (!approverName) {
      return NextResponse.json({ pending: [] });
    }

    const ref = db.collectionGroup("userReports");

    // ----------------------------------------------------------------
    // [1] 쿼리 구성: 내가 결재해야 할 문서 + 내가 신청한 대기 문서
    // ----------------------------------------------------------------
    const queries = [
      // 1. 내가 1차 결재자 & 1차 대기
      ref
        .where("status", "==", "1차 결재 대기")
        .where("approvers.first", "array-contains", approverName),

      // 2. 내가 2차 결재자 & 2차 대기
      ref
        .where("status", "==", "2차 결재 대기")
        .where("approvers.second", "array-contains", approverName),

      // 3. 내가 3차 결재자 & 3차 대기
      ref
        .where("status", "==", "3차 결재 대기")
        .where("approvers.third", "array-contains", approverName),

      // 4. 내가 신청한 문서 (대기 상태 전체)
      ref
        .where("userName", "==", approverName)
        .where("status", "in", [
          "1차 결재 대기",
          "2차 결재 대기",
          "3차 결재 대기",
        ]),
    ];

    // 병렬 실행
    const snapshots = await Promise.all(queries.map((q) => q.get()));

    // ----------------------------------------------------------------
    // [2] 데이터 병합 및 중복 제거
    // ----------------------------------------------------------------
    const docsMap = new Map<string, ReportDoc>();

    snapshots.forEach((snap) => {
      snap.docs.forEach((doc) => {
        const data = doc.data();

        // Timestamp 변환 안전 처리
        const createdAt =
          data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : (data.createdAt as number) || Date.now();

        docsMap.set(doc.id, {
          id: doc.id,
          userName: data.userName || "",
          title: data.title || "제목 없음",
          content: data.content || "",
          status: data.status || "대기",
          reportType: data.reportType || "general",
          approvers: data.approvers || {},
          createdAt: createdAt,
          docType: "report", // ✅ 중요: 휴가와 구분하기 위한 필드
        });
      });
    });

    const list = Array.from(docsMap.values());

    // 최신순 정렬
    list.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ pending: list });
  } catch (error) {
    console.error("Error fetching report pending list:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
