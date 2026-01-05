import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// vacation 문서 타입 정의
interface VacationRequest {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  types: string | string[]; // 배열 혹은 문자열
  status: string;
  daysUsed: number;
  reason: string;
  approvers: {
    first?: string[];
    second?: string[];
    shared?: string[];
  };
  createdAt?: number;
}

/**
 * ✅ 1️⃣ [POST] 관리자/CEO용
 * 결재자 이름으로 결재 대기 목록 조회
 */
export async function POST(req: NextRequest) {
  try {
    const { approverName } = await req.json();

    if (!approverName) {
      return NextResponse.json(
        { error: "결재자 이름이 누락되었습니다." },
        { status: 400 }
      );
    }

    // 💡 중요: 휴가 신청서는 하위 컬렉션(requests)에 있으므로 collectionGroup 사용
    const requestsRef = db.collectionGroup("requests");

    // [조건 1] 내가 1차 결재자이고, 상태가 '1차 결재 대기'인 문서
    const firstQuery = requestsRef
      .where("status", "==", "1차 결재 대기")
      .where("approvers.first", "array-contains", approverName)
      .get();

    // [조건 2] 내가 2차 결재자이고, 상태가 '2차 결재 대기'인 문서
    const secondQuery = requestsRef
      .where("status", "==", "2차 결재 대기")
      .where("approvers.second", "array-contains", approverName)
      .get();

    // 병렬로 실행하여 성능 최적화
    const [firstSnap, secondSnap] = await Promise.all([
      firstQuery,
      secondQuery,
    ]);

    // 결과 합치기
    const pendingDocs: VacationRequest[] = [
      ...firstSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as VacationRequest)
      ),
      ...secondSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as VacationRequest)
      ),
    ];

    // 날짜 최신순 정렬 (선택 사항)
    pendingDocs.sort((a, b) => {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ pending: pendingDocs });
  } catch (err) {
    console.error("❌ 결재 대기 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}

/**
 * ✅ 2️⃣ [GET] 일반 사용자(신청자)용 - 대시보드 "진행중인 결재" 숫자
 * 기능: 내가 신청한 휴가 중 아직 완료되지 않은(1차/2차 대기) 건수 반환
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userDocId = searchParams.get("userDocId");

    if (!userDocId) {
      return NextResponse.json({ error: "userDocId 누락" }, { status: 400 });
    }

    const requestsRef = db
      .collection("vacation")
      .doc(userDocId)
      .collection("requests");

    // 상태가 '1차 결재 대기' 또는 '2차 결재 대기'인 것 조회
    // Firestore 'in' 쿼리 사용
    const snap = await requestsRef
      .where("status", "in", ["1차 결재 대기", "2차 결재 대기"])
      .get();

    return NextResponse.json({ pendingCount: snap.size });
  } catch (err) {
    console.error("❌ 내 대기 건수 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
