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
      .collection("reports")
      .doc(userName)
      .collection("userReports")
      .doc();

    await docRef.set({
      title,
      content,
      userName,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 2. [알림] reportRecipients 조회 및 발송
    const employeeQuery = await db
      .collection("employee")
      .where("userName", "==", userName)
      .get();

    if (!employeeQuery.empty) {
      const empData = employeeQuery.docs[0].data();
      // report 수신자 가져오기 (없으면 빈 배열)
      const recipients: string[] = empData.recipients?.report || [];

      if (recipients.length > 0) {
        const batch = db.batch();

        recipients.forEach((recipientName) => {
          // [변경 2] 알림 저장 경로 수정
          // notifications 컬렉션 -> [받는사람] 문서 -> userNotifications 서브컬렉션
          const notiRef = db
            .collection("notifications")
            .doc(recipientName) // 받는 사람 이름으로 된 문서
            .collection("userNotifications")
            .doc();

          batch.set(notiRef, {
            targetUserName: recipientName,
            fromUserName: userName,
            type: "report",
            message: `${userName}님이 보고서를 작성했습니다.`,
            link: `/main/report/posts/${docRef.id}`,
            isRead: false,
            createdAt: Date.now(),
          });
        });
        await batch.commit();
      }
    }

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
