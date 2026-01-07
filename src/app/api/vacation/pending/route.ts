import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// vacation 문서 타입 정의
interface VacationRequest {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  types: string | string[];
  status: string;
  daysUsed: number;
  reason: string;
  approvers: {
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };
  createdAt?: number;
}

/**
 * ✅ 1️⃣ [POST] 결재 대기 목록 조회
 * 기능 1: 내가 결재해야 할 문서 (1차, 2차, 3차)
 * 기능 2: 내가 신청했는데 아직 대기 중인 문서
 */
export async function POST(req: NextRequest) {
  try {
    const { approverName } = await req.json();

    if (!approverName) {
      return NextResponse.json(
        { error: "사용자 이름이 누락되었습니다." },
        { status: 400 }
      );
    }

    // 💡 모든 하위 컬렉션(requests) 검색
    const requestsRef = db.collectionGroup("requests");

    // ---------------------------------------------------------
    // [A] 내가 '결재'해야 할 문서 찾기
    // ---------------------------------------------------------

    // 1. 1차 결재자이고, 상태가 '1차 결재 대기'
    const firstQuery = requestsRef
      .where("status", "==", "1차 결재 대기")
      .where("approvers.first", "array-contains", approverName)
      .get();

    // 2. 2차 결재자이고, 상태가 '2차 결재 대기'
    const secondQuery = requestsRef
      .where("status", "==", "2차 결재 대기")
      .where("approvers.second", "array-contains", approverName)
      .get();

    // 3. 3차 결재자이고, 상태가 '3차 결재 대기'
    const thirdQuery = requestsRef
      .where("status", "==", "3차 결재 대기")
      .where("approvers.third", "array-contains", approverName)
      .get();

    // ---------------------------------------------------------
    // [B] 내가 '신청'한 문서 중 대기 중인 것 찾기 (신청자 본인 확인용)
    // ---------------------------------------------------------
    const myRequestQuery = requestsRef
      .where("userName", "==", approverName)
      .where("status", "in", [
        "1차 결재 대기",
        "2차 결재 대기",
        "3차 결재 대기",
      ])
      .get();

    // 병렬 실행
    const [firstSnap, secondSnap, thirdSnap, myRequestSnap] = await Promise.all(
      [firstQuery, secondQuery, thirdQuery, myRequestQuery]
    );

    // ---------------------------------------------------------
    // [C] 결과 합치기 (Map을 사용하여 중복 제거)
    // ---------------------------------------------------------
    const docsMap = new Map<string, VacationRequest>();

    const addToMap = (snap: FirebaseFirestore.QuerySnapshot) => {
      snap.docs.forEach((doc) => {
        docsMap.set(doc.id, { id: doc.id, ...doc.data() } as VacationRequest);
      });
    };

    addToMap(firstSnap);
    addToMap(secondSnap);
    addToMap(thirdSnap);
    addToMap(myRequestSnap);

    // 배열로 변환 및 정렬 (최신순)
    const pendingDocs = Array.from(docsMap.values()).sort((a, b) => {
      const dateA = a.createdAt || 0;
      const dateB = b.createdAt || 0;
      return dateB - dateA;
    });

    return NextResponse.json({ pending: pendingDocs });
  } catch (err) {
    console.error("❌ 결재 대기 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
