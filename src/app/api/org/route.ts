// src/app/api/org/route.ts
import { NextResponse } from "next/server";
import admin from "firebase-admin";

// 이미 초기화 안 되어 있으면
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
export async function GET() {
  try {
    // firestore안에있는 collection -> orgData를 부르는 코드
    const querySnapshot = await db
      .collection("orgData")
      .orderBy("order", "asc")
      .get();

    // firestore 문서들을 순회 데이터 변환
    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id, // collection안에 있는 문서 번호를 칭함
      ...doc.data(), // 문서 안에 있는 데이터들을 뜻함.
    }));

    return NextResponse.json(data); // json형태로 응답
  } catch (error) {
    console.error("Firestore 불러오기 오류:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
