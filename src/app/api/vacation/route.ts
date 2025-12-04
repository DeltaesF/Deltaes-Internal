import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userDocId,
      startDate,
      endDate,
      types,
      days,
      reason,
      approvers,
      userName,
    } = body;

    if (!userDocId) {
      return NextResponse.json(
        { success: false, error: "로그인 정보가 없습니다." },
        { status: 400 }
      );
    }

    // ✅ vacation/{userDocId}/requests 컬렉션에 새 문서 추가
    const vacationRef = db.collection("vacation").doc(userDocId);
    await vacationRef.collection("requests").add({
      startDate,
      endDate,
      types,
      daysUsed: days,
      reason,
      status: "대기", // 승인 전
      approvers,
      userName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: "휴가 신청 및 잔여일수 업데이트 완료",
    });
  } catch (err) {
    console.error("❌ Firestore Error:", err);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
