import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldPath } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const { vacationId } = await req.json();

    if (!vacationId) {
      return NextResponse.json(
        { error: "필수 정보가 누락되었습니다." },
        { status: 400 }
      );
    }

    // ✅ [수정] 작성자 이름(fromUserName) 상관없이 ID로 직접 찾기 (Collection Group Query)
    // Firestore에서 모든 'requests' 컬렉션 중 ID가 일치하는 문서를 찾습니다.
    const querySnapshot = await db
      .collectionGroup("requests")
      .where(FieldPath.documentId(), "==", vacationId)
      .get();

    if (querySnapshot.empty) {
      return NextResponse.json(
        { error: "해당 휴가 내역을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();

    return NextResponse.json({
      id: docSnap.id,
      userName: data?.userName || "알 수 없음",
      startDate: data?.startDate,
      endDate: data?.endDate,
      status: data?.status,
      reason: data?.reason,
      daysUsed: data?.daysUsed,
      type: data?.type,
      types: data?.types, // 배열 처리
    });
  } catch (error) {
    console.error("Error fetching vacation detail:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
