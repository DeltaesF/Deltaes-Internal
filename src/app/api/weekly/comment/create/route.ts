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
    const { weeklyId, authorUserName, commenterName, content } =
      await req.json();

    if (!weeklyId || !authorUserName || !commenterName || !content) {
      return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });
    }

    // 1. 댓글 저장
    const commentRef = db
      .collection("weekly")
      .doc(authorUserName)
      .collection("userWeeklys")
      .doc(weeklyId)
      .collection("comments")
      .doc();

    await commentRef.set({
      userName: commenterName,
      content,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 2. 게시글 commentCount 증가
    const weeklyRef = db
      .collection("weekly")
      .doc(authorUserName)
      .collection("userWeeklys")
      .doc(weeklyId);

    await weeklyRef.update({
      commentCount: FieldValue.increment(1),
    });

    // 3. 알림 발송 (작성자가 본인이 아닐 때만)
    if (authorUserName !== commenterName) {
      const notiRef = db
        .collection("notifications")
        .doc(authorUserName)
        .collection("userNotifications")
        .doc();

      await notiRef.set({
        targetUserName: authorUserName,
        fromUserName: commenterName,
        type: "weekly_comment", // 주간 업무 댓글 알림 타입
        message: `${commenterName}님이 주간 업무 보고에 코멘트를 남겼습니다.`,
        link: `/main/work/weekly/${weeklyId}`,
        isRead: false,
        createdAt: Date.now(),
      });
    }

    return NextResponse.json({ success: true, id: commentRef.id });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
