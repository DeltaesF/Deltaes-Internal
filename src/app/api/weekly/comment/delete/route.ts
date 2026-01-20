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
    const { weeklyId, authorUserName, commentId, requestUserName } =
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
      return NextResponse.json({ error: "삭제 권한 없음" }, { status: 403 });

    await commentRef.delete();

    // commentCount 감소
    const weeklyRef = db
      .collection("weekly")
      .doc(authorUserName)
      .collection("userWeeklys")
      .doc(weeklyId);

    await weeklyRef.update({
      commentCount: FieldValue.increment(-1),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
