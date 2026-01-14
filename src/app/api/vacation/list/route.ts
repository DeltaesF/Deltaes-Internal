import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
// ✅ [수정] 필요한 Firestore 타입 Import
import {
  Query,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase-admin/firestore";

interface VacationRequest {
  startDate: string;
  endDate: string;
  types: string;
  daysUsed: number;
  reason: string;
  status: string;
  createdAt: number;
  userName: string;
  userId: string;
}

type ApprovalHistoryEntry = {
  approver: string;
  status: string;
  comment?: string;
  approvedAt: FirebaseFirestore.Timestamp;
};

type VacationDoc = {
  id: string;
  approvers: { first?: string[]; second?: string[] };
  status: string;
  approvalHistory?: ApprovalHistoryEntry[];
};

export async function POST(req: Request) {
  try {
    const { role, userName, page = 1, limit = 8 } = await req.json();
    const requestsRef = db.collectionGroup("requests");

    // ✅ list의 타입을 DocumentData로 구체화
    let list: (VacationDoc | DocumentData)[] = [];
    let totalCount = 0;

    // ------------------------------------------------------------------
    // [CASE 1] 일반 사용자 (내 휴가 내역)
    // ------------------------------------------------------------------
    if (role === "user") {
      let query: Query = requestsRef.where("userName", "==", userName);

      const countSnapshot = await query.count().get();
      totalCount = countSnapshot.data().count;

      query = query.orderBy("createdAt", "desc");

      const offset = (page - 1) * limit;
      const snapshot = await query.limit(limit).offset(offset).get();

      list = snapshot.docs.map((doc: QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data(),
      }));
    }
    // ------------------------------------------------------------------
    // [CASE 2] 관리자/CEO (결재 대기/처리 문서)
    // ------------------------------------------------------------------
    else {
      let snapshot;

      if (role === "admin") {
        snapshot = await requestsRef
          .where("status", "==", "대기")
          .where("approvers.first", "array-contains", userName)
          .get();
      } else if (role === "ceo") {
        const [firstSnap, secondSnap] = await Promise.all([
          requestsRef
            .where("approvers.first", "array-contains", userName)
            .get(),
          requestsRef
            .where("approvers.second", "array-contains", userName)
            .get(),
        ]);
        const mergedDocs = new Map();
        firstSnap.docs.forEach((doc) => mergedDocs.set(doc.id, doc));
        secondSnap.docs.forEach((doc) => mergedDocs.set(doc.id, doc));
        snapshot = { docs: Array.from(mergedDocs.values()) };
      }

      if (snapshot) {
        let docsToMap = snapshot.docs;

        if (role === "admin") {
          docsToMap = snapshot.docs.filter((doc) => {
            const data = doc.data() as VacationDoc;
            const history = data.approvalHistory || [];
            return !history.some((entry) => entry.approver === userName);
          });
        } else if (role === "ceo") {
          docsToMap = snapshot.docs.filter((doc) => {
            const data = doc.data() as VacationDoc;
            const status = data.status;
            const history = data.approvalHistory || [];
            const firstApprovers = data.approvers?.first || [];
            const secondApprovers = data.approvers?.second || [];

            if (history.some((entry) => entry.approver === userName))
              return false;

            if (firstApprovers.includes(userName)) {
              if (status === "대기") return true;
            }
            if (secondApprovers.includes(userName)) {
              if (status === "1차 결재 완료") return true;
              if (status === "대기" && firstApprovers.length === 0) return true;
            }
            return false;
          });
        }

        totalCount = docsToMap.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedDocs = docsToMap.slice(startIndex, endIndex);

        list = paginatedDocs.map((doc: QueryDocumentSnapshot) => ({
          id: doc.id,
          ...doc.data(),
        }));
      }
    }

    // ------------------------------------------------------------------
    // [공통] 데이터 변환 (Timestamp -> Number)
    // ------------------------------------------------------------------
    const formattedList = list.map((item) => {
      // item을 VacationDoc으로 타입 단언하여 내부 속성 접근
      const docData = item as VacationDoc;

      const approvalHistory =
        docData.approvalHistory?.map((h) => {
          // ✅ [수정] 'as any' 대신 안전한 타입 체크 사용
          // unknown으로 먼저 변환 후, 객체이며 toMillis 함수가 있는지 확인
          const rawTime = h.approvedAt as unknown;

          let timeMillis: number | null = null;

          if (
            rawTime &&
            typeof rawTime === "object" &&
            "toMillis" in rawTime &&
            typeof (rawTime as { toMillis: () => number }).toMillis ===
              "function"
          ) {
            // Firestore Timestamp인 경우
            timeMillis = (rawTime as { toMillis: () => number }).toMillis();
          } else if (typeof rawTime === "number") {
            // 이미 숫자인 경우
            timeMillis = rawTime;
          }

          return {
            ...h,
            approvedAt: timeMillis,
          };
        }) || [];

      return {
        ...item,
        approvalHistory,
      };
    });

    return NextResponse.json({ list: formattedList, totalCount });
  } catch (err) {
    console.error("휴가 리스트 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}

// GET 핸들러 (캘린더용 - 기존 코드 유지)
export async function GET() {
  try {
    const employeesSnap = await db.collection("employee").get();
    const allRequests: VacationRequest[] = [];

    for (const emp of employeesSnap.docs) {
      const empData = emp.data();
      const reqSnap = await db
        .collection("vacation")
        .doc(emp.id)
        .collection("requests")
        .get();

      reqSnap.forEach((r) => {
        const data = r.data();
        allRequests.push({
          startDate: data.startDate,
          endDate: data.endDate,
          types: data.types,
          daysUsed: data.daysUsed,
          reason: data.reason,
          status: data.status,
          createdAt: data.createdAt,
          userName: empData.userName,
          userId: emp.id,
        });
      });
    }

    return NextResponse.json({ requests: allRequests });
  } catch (error) {
    console.error("❌ Error fetching vacation data:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
