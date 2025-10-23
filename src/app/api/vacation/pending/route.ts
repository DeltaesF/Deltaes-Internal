import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// vacation 문서 타입 정의
interface VacationData {
  id: string;
  userName: string;
  status: string;
  approvers?: {
    first?: string[];
    second?: string[];
    shared?: string[];
  };
  [key: string]: any;
}

/**
 * ✅ 1️⃣ [POST] 관리자/CEO용
 * 결재자 이름으로 결재 대기 목록 조회
 */
export async function POST(req: Request) {
  try {
    const { approverName } = await req.json();

    if (!approverName) {
      return NextResponse.json(
        { error: "결재자 이름이 누락되었습니다." },
        { status: 400 }
      );
    }

    const snapshot = await db.collection("vacation").get();

    const pendingDocs: VacationData[] = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as VacationData))
      .filter(
        (v) =>
          (v.status === "1차 결재 대기" &&
            v.approvers?.first?.includes(approverName)) ||
          (v.status === "2차 결재 대기" &&
            v.approvers?.second?.includes(approverName))
      );

    return NextResponse.json({ pending: pendingDocs });
  } catch (err) {
    console.error("❌ 결재 대기 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}

/**
 * ✅ 2️⃣ [GET] 일반 사용자용
 * 본인이 신청한 휴가 중 대기 상태인 건수 반환
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userDocId = searchParams.get("userDocId");
  if (!userDocId)
    return NextResponse.json({ error: "userDocId 누락" }, { status: 400 });

  const requestsRef = db
    .collection("vacation")
    .doc(userDocId)
    .collection("requests");
  const snap = await requestsRef.where("status", "==", "대기").get();

  return NextResponse.json({ pendingCount: snap.size });
}
