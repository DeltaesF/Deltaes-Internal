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

type ApprovalHistoryEntry = {
  approver: string;
  status: string;
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
    const { role, userName } = await req.json();
    const requestsRef = db.collectionGroup("requests");
    let snapshot;

    // ------------------------------------------------------------------
    // [1] DB 조회 단계 (역할별로 가져올 데이터 범위 설정)
    // ------------------------------------------------------------------
    if (role === "user") {
      // 내 문서 전체 조회
      snapshot = await requestsRef.where("userName", "==", userName).get();
    } else if (role === "admin") {
      // 1차 결재자: 내가 'first'에 포함된 '대기' 상태 문서
      snapshot = await requestsRef
        .where("status", "==", "대기")
        .where("approvers.first", "array-contains", userName)
        .get();
    } else if (role === "ceo") {
      // 🔽 [수정] CEO는 1차 결재자일 수도 있고, 2차 결재자일 수도 있습니다.
      // 따라서 두 경우를 모두 조회해서 하나로 합칩니다.
      const [firstSnap, secondSnap] = await Promise.all([
        // 내가 1차 결재자에 포함된 경우 조회
        requestsRef.where("approvers.first", "array-contains", userName).get(),
        // 내가 2차 결재자에 포함된 경우 조회
        requestsRef.where("approvers.second", "array-contains", userName).get(),
      ]);

      // 문서 ID를 키로 사용하여 중복 제거 (Map 사용)
      const mergedDocs = new Map();
      firstSnap.docs.forEach((doc) => mergedDocs.set(doc.id, doc));
      secondSnap.docs.forEach((doc) => mergedDocs.set(doc.id, doc));

      // 합쳐진 결과를 snapshot 형태로 모방
      snapshot = { docs: Array.from(mergedDocs.values()) };
    } else {
      return NextResponse.json({ list: [] });
    }

    // ------------------------------------------------------------------
    // [2] 필터링 단계 (상세 조건 체크)
    // ------------------------------------------------------------------
    let docsToMap = snapshot.docs;

    // [Admin 필터] 내가 이미 승인한 건 제외
    if (role === "admin") {
      docsToMap = snapshot.docs.filter((doc) => {
        const data = doc.data() as VacationDoc;
        const history = data.approvalHistory || [];
        const alreadyApproved = history.some(
          (entry) => entry.approver === userName
        );
        return !alreadyApproved;
      });
    }
    // [CEO 필터] 내가 결재해야 할 문서인지 확인
    else if (role === "ceo") {
      docsToMap = snapshot.docs.filter((doc) => {
        const data = doc.data() as VacationDoc;
        const status = data.status;
        const history = data.approvalHistory || [];
        const firstApprovers = data.approvers?.first || [];
        const secondApprovers = data.approvers?.second || [];

        // 1. 이미 내가 승인했으면 목록에서 제외
        if (history.some((entry) => entry.approver === userName)) {
          return false;
        }

        // 2. [CASE A] 내가 1차 결재자로 지정된 경우 (안 보이던 건 해결)
        if (firstApprovers.includes(userName)) {
          // 대기 상태면 내가 결재해야 함
          if (status === "대기") return true;
        }

        // 3. [CASE B] 내가 2차 결재자로 지정된 경우
        if (secondApprovers.includes(userName)) {
          // 1차 결재가 끝난 건 (정상 흐름)
          if (status === "1차 결재 완료") return true;
          // 1차 결재자가 아예 없는 건 (바로 넘어옴)
          if (status === "대기" && firstApprovers.length === 0) return true;
        }

        return false;
      });
    }

    // [3] 최종 결과 반환
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

// GET 핸들러 (캘린더용)
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
