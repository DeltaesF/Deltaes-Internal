import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

interface VacationRequest {
  startDate: string;
  endDate: string;
  types: string;
  daysUsed: number;
  reason: string;
  status: string;
  createdAt: string;
  userName: string;
  userId: string;
}

// [2] POST 핸들러의 admin 필터링을 위한 타입을 추가합니다.
type ApprovalHistoryEntry = {
  approver: string;
  status: string;
  approvedAt: FirebaseFirestore.Timestamp;
};

type VacationDoc = {
  id: string;
  approvalHistory?: ApprovalHistoryEntry[];
  // ... (userName, startDate 등 VacationRequest의 모든 필드)
};

export async function POST(req: Request) {
  try {
    const { role, userName } = await req.json();

    // ✅ 모든 vacation/{userDocId}/requests 컬렉션을 통합 조회
    const requestsRef = db.collectionGroup("requests");
    let snapshot;

    if (role === "user") {
      // 일반 사용자는 "대기" 중인 자기 요청을 봅니다.
      snapshot = await requestsRef
        .where("status", "==", "대기")
        .where("userName", "==", userName)
        .get();
    } else if (role === "admin") {
      // [3] 1차 결재자는 '대기' 상태 + 'approvers.first'에 내가 포함된 것 일단 모두 조회
      snapshot = await requestsRef
        .where("status", "==", "대기")
        .where("approvers.first", "array-contains", userName)
        .get();
    } else if (role === "ceo") {
      // 2차 결재자는 "1차 결재 완료"된 요청을 봅니다.
      snapshot = await requestsRef
        .where("status", "==", "1차 결재 완료")
        .where("approvers.second", "array-contains", userName)
        .get();
    } else {
      return NextResponse.json({ list: [] });
    }

    // [4] snapshot.docs를 바로 list로 만들기 전에 후처리합니다.
    let docsToMap = snapshot.docs;

    // [5] admin 역할일 경우, JS로 필터링을 추가합니다.
    if (role === "admin") {
      docsToMap = snapshot.docs.filter((doc) => {
        // 타입을 VacationDoc으로 지정
        const data = doc.data() as VacationDoc;
        const history = data.approvalHistory || [];

        // 'approvalHistory'에 'approver'가 'userName'(현재 사용자)과
        // 일치하는 기록이 있는지 확인합니다.
        const alreadyApproved = history.some(
          (entry) => entry.approver === userName
        );

        // [6] 내가 승인한 기록이 '없는' 항목만 반환합니다.
        return !alreadyApproved;
      });
    }

    // [7] 필터링된 docsToMap을 최종 list로 만듭니다.
    const list = docsToMap.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ list });
  } catch (err) {
    console.error("휴가 리스트 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}

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
