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
    const { userName, title, content, fileUrl, fileName } = await req.json();

    if (!userName || !title || !content)
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );

    // 1. 직원 정보(결재선) 조회
    const employeeQuery = await db
      .collection("employee")
      .where("userName", "==", userName)
      .get();

    let approvalLine = { first: [], second: [], third: [], shared: [] };

    if (!employeeQuery.empty) {
      const empData = employeeQuery.docs[0].data();
      approvalLine = empData.recipients?.approval || approvalLine;
    }

    // 2. 문서 저장
    const docRef = db
      .collection("approvals")
      .doc(userName)
      .collection("userApprovals")
      .doc();

    await docRef.set({
      title,
      content,
      userName,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      approvers: approvalLine,
      status: "1차 결재 대기",
      createdAt: FieldValue.serverTimestamp(),
    });

    // 3. [알림] 결재자(요청) + 나머지(참조) 발송
    const batch = db.batch();

    // -------------------------------------------------------------
    // [A] 1차 결재자 (결재 요청)
    // -------------------------------------------------------------
    const firstApprovers: string[] = approvalLine.first || [];
    firstApprovers.forEach((approver) => {
      const notiRef = db
        .collection("notifications")
        .doc(approver)
        .collection("userNotifications")
        .doc();

      batch.set(notiRef, {
        targetUserName: approver,
        fromUserName: userName,
        type: "approval",
        message: `[${title}] 결재 요청이 도착했습니다.`,
        link: `/main/my-approval/pending`, // 결재 대기함으로 이동
        isRead: false,
        createdAt: Date.now(),
      });
    });

    // -------------------------------------------------------------
    // [B] 2차, 3차 결재자 + 공유자 (참조 알림)
    // -------------------------------------------------------------
    const referenceUsers = [
      ...(approvalLine.second || []),
      ...(approvalLine.third || []),
      ...(approvalLine.shared || []),
    ];

    const uniqueRefs = [...new Set(referenceUsers)];

    uniqueRefs.forEach((targetName: string) => {
      // 1차 결재자와 겹치면 제외
      if (firstApprovers.includes(targetName)) return;

      const notiRef = db
        .collection("notifications")
        .doc(targetName)
        .collection("userNotifications")
        .doc();

      batch.set(notiRef, {
        targetUserName: targetName,
        fromUserName: userName,
        type: "approval",
        message: `[공유/예정] ${title} 결재 요청이 도착했습니다.`,
        link: `/main/workoutside/approvals/${docRef.id}`, // 품의서 상세 페이지로 이동
        isRead: false,
        createdAt: Date.now(),
      });
    });

    await batch.commit();

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
