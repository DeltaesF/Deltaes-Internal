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
    const { weeklyId, authorUserName, commentId, requestUserName, content } =
      await req.json();

    const commentRef = db
      .collection("weekly")
      .doc(authorUserName)
      .collection("userWeeklys")
      .doc(weeklyId)
      .collection("comments")
      .doc(commentId);

    const doc = await commentRef.get();
    if (!doc.exists)
      return NextResponse.json({ error: "댓글 없음" }, { status: 404 });
    if (doc.data()?.userName !== requestUserName)
      return NextResponse.json({ error: "수정 권한 없음" }, { status: 403 });

    await commentRef.update({
      content,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
