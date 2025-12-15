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
    // [주의] 복합 쿼리(where + orderBy) 사용 시 Firestore 색인(Index) 생성이 필요할 수 있습니다.
    // 에러가 발생하면 콘솔의 링크를 눌러 색인을 생성해주세요.
    const snapshot = await db
      .collection("notifications")
      .where("targetUserName", "==", userName)
      .orderBy("createdAt", "desc")
      .get();

    const list = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        targetUserName: data.targetUserName,
        fromUserName: data.fromUserName,
        type: data.type, // 'daily', 'weekly', 'vacation' 등
        message: data.message,
        link: data.link,
        isRead: data.isRead,
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
