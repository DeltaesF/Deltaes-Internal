import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// ✅ [수정] any 제거 및 구체적인 타입 정의
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

  // 🔹 여기가 수정된 부분입니다.
  createdAt?:
    | Timestamp
    | { _seconds: number; _nanoseconds?: number }
    | number
    | string;

  // 휴가 전용 필드
  startDate?: string;
  endDate?: string;
  reason?: string;
  types?: string[];
  daysUsed?: number;

  // 보고서/품의서 전용 필드
  title?: string;
  reportType?: string;
  approvalType?: string;
  docCategory?: string;
  workType?: string;

  implementDate?: string;

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
    const promises: Promise<ApprovalDoc[]>[] = [];

    // 1. 휴가
    if (filterType === "all" || filterType === "vacation") {
      promises.push(
        fetchDocs("requests").then((docs) =>
          docs.map((d) => ({ ...d, category: "vacation" }))
        )
      );
    }

    // 2. 보고서
    if (filterType === "all" || filterType === "report") {
      promises.push(
        fetchDocs("userReports").then((docs) =>
          docs.map((d) => ({ ...d, category: "report" }))
        )
      );
    }

    // 3. 품의서 & 통합
    if (
      filterType === "all" ||
      filterType === "approval" ||
      filterType === "report"
    ) {
      promises.push(
        fetchDocs("userApprovals").then((docs) =>
          docs.map((d) => {
            let cat = "approval";
            if (
              d.docCategory === "report" ||
              (d.workType && d.workType.includes("report")) ||
              d.approvalType === "business_trip"
            ) {
              cat = "report";
            }
            return { ...d, category: cat };
          })
        )
      );
    }

    const results = await Promise.all(promises);
    const rawList = results.flat();

    // ----------------------------------------------------------------
    // [3] 필터링 & 정렬
    // ----------------------------------------------------------------

    // 헬퍼: createdAt 타입을 확인하여 밀리초 숫자로 변환
    const getCreatedAtMillis = (c: ApprovalDoc["createdAt"]): number => {
      if (!c) return 0;
      if (typeof c === "number") return c;
      if (typeof c === "string") return new Date(c).getTime();

      // Timestamp 객체 체크 ('toMillis' 메서드가 있는지)
      if ("toMillis" in c && typeof c.toMillis === "function") {
        return c.toMillis();
      }

      // Map 형태 체크 ('_seconds' 속성이 있는지)
      if ("_seconds" in c) {
        return c._seconds * 1000;
      }

      return 0;
    };

    const getSortTime = (item: ApprovalDoc): number => {
      // 1순위: implementDate
      if (item.implementDate) {
        return new Date(item.implementDate).getTime();
      }
      // 2순위: createdAt
      return getCreatedAtMillis(item.createdAt);
    };

    const filteredList = rawList
      .filter((item) => {
        if (filterType !== "all" && item.category !== filterType) {
          return false;
        }

        // ✅ [핵심 수정] 완료함 필터 조건 강화 (안전장치 추가)

        // 조건 1: 문서가 "완료"된 상태인가?
        const s = item.status || "";
        const isCompleted =
          s === "최종 승인 완료" ||
          s === "결재 완료" ||
          s === "승인" ||
          s.includes("반려");

        // 진행 중(대기) 상태는 완료함에서 제외 (단, '최종 승인 완료'는 예외)
        const isPending =
          (s.includes("대기") || s.includes("중")) && s !== "최종 승인 완료";

        if (!isCompleted || isPending) return false;

        // 조건 2: 내가 이 문서의 당사자인가?

        // A. 결재 이력(History)에 내 이름이 있으면 무조건 OK (가장 정확)
        const hasHistory = item.approvalHistory?.some(
          (entry) => entry.approver === userName
        );
        if (hasHistory) return true;

        // B. [추가된 안전장치] 이력이 없더라도, 내가 결재 라인(approvers)에 포함되어 있다면 OK
        // (과거 버그로 이력이 누락된 경우를 구제)
        const isApprover =
          item.approvers?.first?.includes(userName) ||
          item.approvers?.second?.includes(userName) ||
          item.approvers?.third?.includes(userName);

        if (isApprover) return true;

        // C. 기안자(작성자)라면 OK
        if (item.userName === userName) return true;

        return false;
      })
      .sort((a, b) => {
        const timeA = getSortTime(a);
        const timeB = getSortTime(b);
        return timeB - timeA; // 내림차순 (최신순)
      });

    // ----------------------------------------------------------------
    // [4] 페이지네이션
    // ----------------------------------------------------------------
    const totalCount = filteredList.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedList = filteredList.slice(startIndex, endIndex);

    const responseList = paginatedList.map((item) => ({
      ...item,
      // 클라이언트에 내려줄 때 안전하게 숫자로 변환
      createdAt: getCreatedAtMillis(item.createdAt),

      approvalHistory: item.approvalHistory?.map((history) => ({
        ...history,
        approvedAt: history.approvedAt.toMillis(),
      })),
    }));

    return NextResponse.json({ list: responseList, totalCount });
  } catch (err) {
    console.error("❌ 결재 완료 목록 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
