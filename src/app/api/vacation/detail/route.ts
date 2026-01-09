import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { fromUserName, vacationId } = await req.json();

    if (!fromUserName || !vacationId) {
      return NextResponse.json(
        { error: "필수 정보가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 작성자의 휴가 신청 내역에서 특정 문서 가져오기
    const docRef = db
      .collection("vacation")
      .doc(fromUserName)
      .collection("requests")
      .doc(vacationId);

    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: "해당 휴가 내역을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const data = docSnap.data();

    // 포맷 맞춰서 반환
    return NextResponse.json({
      id: docSnap.id,
      userName: data?.userName || fromUserName,
      startDate: data?.startDate,
      endDate: data?.endDate,
      status: data?.status,
      reason: data?.reason,
      daysUsed: data?.daysUsed,
      type: data?.type, // 주요 타입 (연차 등)
      types: data?.types, // 상세 타입 배열 (오전반차 등)
    });
  } catch (error) {
    console.error("Error fetching vacation detail:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
