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

    const docRef = db
      .collection("notice")
      .doc(userName)
      .collection("userNotices")
      .doc();

    await docRef.set({
      title,
      content,
      userName,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    // [알림] 모든 직원에게 발송
    const allEmployees = await db.collection("employee").get();
    // 배치 처리는 한 번에 최대 500개까지만 가능하므로,
    // 직원이 500명이 넘을 경우를 대비해 나눠서 처리하는 것이 안전하지만,
    // 현재 규모에서는 단일 배치로 처리합니다. (필요 시 chunk 로직 추가 가능)
    const batch = db.batch();

    allEmployees.docs.forEach((doc) => {
      const emp = doc.data();
      // 작성자 본인 제외
      if (emp.userName !== userName) {
        // [수정] 알림 저장 경로 변경: notifications -> [받는사람] -> userNotifications
        const notiRef = db
          .collection("notifications")
          .doc(emp.userName) // 받는 사람의 문서 ID (이름)
          .collection("userNotifications") // 하위 컬렉션
          .doc();

        batch.set(notiRef, {
          targetUserName: emp.userName, // 받는 사람
          fromUserName: userName, // 보낸 사람
          type: "notice",
          message: `[공지] ${title}`,
          link: `/main/notice/${docRef.id}`, // 이동 링크
          isRead: false,
          createdAt: Date.now(),
        });
      }
    });
    await batch.commit();

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
