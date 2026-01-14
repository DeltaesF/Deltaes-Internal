import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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
    const { dailyId, authorUserName, commenterName, content } =
      await req.json();

    if (!dailyId || !authorUserName || !commenterName || !content) {
      return NextResponse.json(
        { error: "필수 항목이 누락되었습니다." },
        { status: 400 }
      );
    }

    // 작성자의 daily 문서 하위에 comments 컬렉션 생성/추가
    const commentRef = db
      .collection("dailys")
      .doc(authorUserName)
      .collection("userDailys")
      .doc(dailyId)
      .collection("comments")
      .doc();

    await commentRef.set({
      userName: commenterName, // 댓글 작성자
      content,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: commentRef.id });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
