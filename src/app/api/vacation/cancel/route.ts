import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { vacationId, applicantUserName } = await req.json();

    if (!vacationId || !applicantUserName) {
      return NextResponse.json(
        { error: "필수 정보(vacationId, applicantUserName)가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 휴가 문서의 직접 경로를 찾습니다.
    const vacationRef = db
      .collection("vacation")
      .doc(applicantUserName)
      .collection("requests")
      .doc(vacationId);

    const doc = await vacationRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "삭제할 휴가 신청을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const vacationData = doc.data();

    // 서버 측에서 '대기' 상태인지 한 번 더 확인합니다.
    if (vacationData?.status !== "대기") {
      return NextResponse.json(
        {
          error: `이미 '${vacationData?.status}' 상태인 요청은 취소할 수 없습니다.`,
        },
        { status: 403 } // 403 Forbidden (권한 없음/부적절한 요청)
      );
    }

    // 문서 삭제
    await vacationRef.delete();

    return NextResponse.json({
      message: "휴가 요청이 성공적으로 취소되었습니다.",
    });
  } catch (err) {
    console.error("휴가 취소 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
