import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

export async function POST(req: Request) {
  try {
    const { userName } = await req.json();

    if (!userName) {
      return NextResponse.json({ list: [] });
    }

    // notifications 컬렉션에서 targetUserName이 '나'인 것 조회
    // 최신순 정렬 (createdAt desc)
    const snapshot = await db
      .collection("notifications")
      .doc(userName) // 내 이름으로 된 문서 접근
      .collection("userNotifications") // 하위 컬렉션 접근
      .orderBy("createdAt", "desc")
      .get();

    const list = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        targetUserName: userName,
        fromUserName: data.fromUserName,
        type: data.type,
        message: data.message,
        link: data.link,
        isRead: data.isRead,
        vacationId: data.vacationId || null,
        createdAt:
          data.createdAt && typeof data.createdAt.toMillis === "function"
            ? data.createdAt.toMillis()
            : data.createdAt || Date.now(),
      };
    });

    return NextResponse.json({ list });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
