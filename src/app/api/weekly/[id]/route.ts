// src/app/api/daily/[id]/route.ts

import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Firebase Admin 초기화 (기존 코드 유지)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // userWeeklys 컬렉션 전체에서 해당 ID를 가진 문서를 찾습니다.
    // 참고: doc ID를 알고 있다면 바로 접근이 불가능할 수 있습니다 (subcollection 구조라서).
    // 구조가 `dailys/{userName}/userWeeklys/{docId}` 라면 collectionGroup을 써야 찾기 쉽습니다.

    // 방법 1: Collection Group Query로 ID 검색 (가장 추천)
    const snapshot = await db.collectionGroup("userWeeklys").get();
    const doc = snapshot.docs.find((d) => d.id === id);

    if (!doc) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const data = {
      id: doc.id,
      ...doc.data(),
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching detail:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
