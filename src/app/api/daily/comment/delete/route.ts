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
    const { dailyId, authorUserName, commentId, requestUserName } =
      await req.json();

    if (!dailyId || !authorUserName || !commentId || !requestUserName) {
      return NextResponse.json(
        { error: "필수 정보가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 경로: 게시글 작성자(authorUserName) -> userDailys -> dailyId -> comments -> commentId
    const commentRef = db
      .collection("dailys")
      .doc(authorUserName)
      .collection("userDailys")
      .doc(dailyId)
      .collection("comments")
      .doc(commentId);

    const doc = await commentRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "댓글을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const data = doc.data();
    // 작성자 본인 확인
    if (data?.userName !== requestUserName) {
      return NextResponse.json(
        { error: "삭제 권한이 없습니다." },
        { status: 403 }
      );
    }

    await commentRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
