import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// ✅ 통합 데이터 타입 정의
type ApprovalDoc = {
  id: string;
  userName: string;
  status: string;
  approvers: {
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };
  approvalHistory?: {
    approver: string;
    status: string;
    approvedAt: Timestamp;
  }[];
  createdAt?: number; // 정렬용

  // 휴가 전용 필드
  startDate?: string;
  endDate?: string;
  reason?: string;
  types?: string[];
  daysUsed?: number;

  // 보고서/품의서 전용 필드
  title?: string;
  reportType?: string; // 보고서 구분용

  // 카테고리 (API 내부 처리용)
  category?: string;
};

export async function POST(req: Request) {
  try {
    const {
      userName,
      page = 1,
      limit = 12,
      filterType = "all",
    } = await req.json();

    if (!userName) {
      return NextResponse.json({ list: [], totalCount: 0 });
    }

    // ----------------------------------------------------------------
    // [1] 데이터 페칭 헬퍼 함수
    // ----------------------------------------------------------------
    const fetchDocs = async (
      collectionName: string
    ): Promise<ApprovalDoc[]> => {
      const colRef = db.collectionGroup(collectionName);

      // '내가 관여된 문서'를 찾기 위해 여러 조건으로 병렬 쿼리 실행
      const [first, second, third, my] = await Promise.all([
        colRef.where("approvers.first", "array-contains", userName).get(),
        colRef.where("approvers.second", "array-contains", userName).get(),
        colRef.where("approvers.third", "array-contains", userName).get(),
        colRef.where("userName", "==", userName).get(),
      ]);

      const docsMap = new Map<string, ApprovalDoc>();
      const addToMap = (snap: FirebaseFirestore.QuerySnapshot) => {
        snap.docs.forEach((doc) => {
          docsMap.set(doc.id, { id: doc.id, ...doc.data() } as ApprovalDoc);
        });
      };

      addToMap(first);
      addToMap(second);
      addToMap(third);
      addToMap(my);

      return Array.from(docsMap.values());
    };

    // ----------------------------------------------------------------
    // [2] 필터에 따른 데이터 수집
    // ----------------------------------------------------------------
    // ❌ [삭제됨] 사용하지 않는 allItems 변수 제거

    // 병렬 처리를 위한 프로미스 배열 (타입 명시)
    const promises: Promise<ApprovalDoc[]>[] = [];

    // 1. 휴가 (Vacation)
    if (filterType === "all" || filterType === "vacation") {
      promises.push(
        fetchDocs("requests").then((docs) =>
          docs.map((d) => ({ ...d, category: "vacation" }))
        )
      );
    }

    // 2. 보고서 (Report)
    if (filterType === "all" || filterType === "report") {
      promises.push(
        fetchDocs("userReports").then((docs) =>
          docs.map((d) => ({ ...d, category: "report" }))
        )
      );
    }

    // 3. 품의서 (Approval)
    if (filterType === "all" || filterType === "approval") {
      promises.push(
        fetchDocs("userApprovals").then((docs) =>
          docs.map((d) => ({ ...d, category: "approval" }))
        )
      );
    }

    // 모든 데이터 가져오기
    const results = await Promise.all(promises);
    const rawList = results.flat();

    // ----------------------------------------------------------------
    // [3] "완료된 건" 필터링 & 정렬 (메모리 연산)
    // ----------------------------------------------------------------
    const filteredList = rawList
      .filter((item) => {
        // [조건 A] 내가 승인했는지 확인 (History 체크)
        // item이 ApprovalDoc 타입이므로 entry의 타입이 자동으로 추론됨 (any 제거)
        const myApproval = item.approvalHistory?.find(
          (entry) => entry.approver === userName
        );
        if (myApproval) return true;

        // [조건 B] 내가 신청자이고 최종 완료되었는지 확인
        if (item.userName === userName && item.status === "최종 승인 완료") {
          return true;
        }

        return false;
      })
      .sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeB - timeA; // 최신순
      });

    // ----------------------------------------------------------------
    // [4] 페이지네이션 (Slice)
    // ----------------------------------------------------------------
    const totalCount = filteredList.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedList = filteredList.slice(startIndex, endIndex);

    // ✅ [추가] Timestamp -> Number(밀리초) 변환하여 클라이언트로 전송
    const responseList = paginatedList.map((item) => ({
      ...item,
      approvalHistory: item.approvalHistory?.map((history) => ({
        ...history,
        approvedAt: history.approvedAt.toMillis(), // Timestamp를 숫자로 변환
      })),
    }));

    return NextResponse.json({ list: responseList, totalCount });
  } catch (err) {
    console.error("❌ 결재 완료 목록 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
