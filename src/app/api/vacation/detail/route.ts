import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// ✅ [1] DB 데이터 타입 정의 (Firestore 저장 구조)
interface VacationDocData {
  userName: string;
  startDate: string;
  endDate: string;
  status: string;
  reason: string;
  daysUsed: number;
  type: string;
  types?: string[];
  approvers?: {
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };
  approvalHistory?: {
    approver: string;
    status: string;
    comment?: string;
    approvedAt: Timestamp; // DB에는 Timestamp로 저장됨
  }[];
}

export async function POST(req: Request) {
  try {
    const { vacationId, viewerName } = await req.json();

    if (!vacationId || !viewerName) {
      return NextResponse.json(
        { error: "필수 정보가 누락되었습니다." },
        { status: 400 }
      );
    }

    const requestsRef = db.collectionGroup("requests");

    // 병렬 쿼리 실행
    const [sharedSnap, firstSnap, secondSnap, thirdSnap] = await Promise.all([
      requestsRef.where("approvers.shared", "array-contains", viewerName).get(),
      requestsRef.where("approvers.first", "array-contains", viewerName).get(),
      requestsRef.where("approvers.second", "array-contains", viewerName).get(),
      requestsRef.where("approvers.third", "array-contains", viewerName).get(),
    ]);

    // 중복 제거 (Map 사용)
    const docsMap = new Map();
    [
      ...sharedSnap.docs,
      ...firstSnap.docs,
      ...secondSnap.docs,
      ...thirdSnap.docs,
    ].forEach((doc) => {
      docsMap.set(doc.id, doc);
    });

    const foundDoc = docsMap.get(vacationId);

    if (!foundDoc) {
      return NextResponse.json(
        { error: "해당 휴가 내역을 찾을 수 없거나 접근 권한이 없습니다." },
        { status: 404 }
      );
    }

    const data = foundDoc.data() as VacationDocData;

    // ✅ [핵심] Timestamp -> Number(밀리초) 변환
    // approvalHistory가 없으면 빈 배열 처리
    const approvalHistory =
      data.approvalHistory?.map((history) => ({
        ...history,
        approvedAt: history.approvedAt.toMillis(), // Timestamp 객체를 숫자로 변환
      })) || [];

    return NextResponse.json({
      id: foundDoc.id,
      userName: data.userName || "알 수 없음",
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
      reason: data.reason,
      daysUsed: data.daysUsed,
      type: data.type,
      types: data.types,
      approvers: data.approvers,
      approvalHistory, // 변환된 데이터 전송
    });
  } catch (error) {
    console.error("Error fetching vacation detail:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
