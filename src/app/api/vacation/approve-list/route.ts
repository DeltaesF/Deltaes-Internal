import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// 데이터 타입 정의
type VacationType = {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  approvers: { first?: string[]; second?: string[]; third?: string[] };
  approvalHistory?: ApprovalHistoryEntry[];
  createdAt?: number;
};

type ApprovalHistoryEntry = {
  approver: string;
  status: string;
  approvedAt: Timestamp;
};

export async function POST(req: Request) {
  try {
    const { userName } = await req.json(); // 예: "홍성원 프로"

    if (!userName) {
      return NextResponse.json({ list: [] });
    }

    const requestsRef = db.collectionGroup("requests");

    // ----------------------------------------------------------------
    // [1] DB 쿼리: 내가 관여된 문서 찾기 (결재자 OR 신청자)
    // ----------------------------------------------------------------
    const [firstSnap, secondSnap, thirdSnap, mySnap] = await Promise.all([
      // 내가 1, 2, 3차 결재자에 포함된 문서 조회
      requestsRef.where("approvers.first", "array-contains", userName).get(),
      requestsRef.where("approvers.second", "array-contains", userName).get(),
      requestsRef.where("approvers.third", "array-contains", userName).get(),
      // 내가 신청한 문서 조회
      requestsRef.where("userName", "==", userName).get(),
    ]);

    // ----------------------------------------------------------------
    // [2] 데이터 병합 및 필터링 (중복 제거)
    // ----------------------------------------------------------------
    const docsMap = new Map<string, VacationType>();

    const processSnapshot = (snap: FirebaseFirestore.QuerySnapshot) => {
      snap.docs.forEach((doc) => {
        const data = doc.data() as VacationType;
        docsMap.set(doc.id, { ...data, id: doc.id });
      });
    };

    processSnapshot(firstSnap);
    processSnapshot(secondSnap);
    processSnapshot(thirdSnap);
    processSnapshot(mySnap);

    // ----------------------------------------------------------------
    // [3] "완료된 건"만 남기기 (JS 필터링)
    // 조건 A: 내가 결재 승인을 한 이력이 있음 (History 체크)
    // 조건 B: 내가 신청자이고, 최종 승인이 완료됨
    // ----------------------------------------------------------------
    const list = Array.from(docsMap.values())
      .filter((item) => {
        // [조건 A] 내가 승인했는지 확인
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
        // 최신순 정렬 (createdAt 기준, 없으면 0)
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeB - timeA;
      });

    return NextResponse.json({ list });
  } catch (err) {
    console.error("❌ 결재 완료 목록 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
