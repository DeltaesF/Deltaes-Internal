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
      .collection("dailys")
      .doc(userName)
      .collection("userDailys")
      .doc();

    await docRef.set({
      title,
      content,
      userName,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    const employeeQuery = await db
      .collection("employee")
      .where("userName", "==", userName)
      .get();

    if (!employeeQuery.empty) {
      const empData = employeeQuery.docs[0].data();
      const recipients: string[] = empData.reportRecipients || []; // 설정된 수신자들

      if (recipients.length > 0) {
        const batch = db.batch();

        recipients.forEach((recipientName) => {
          const notiRef = db.collection("notifications").doc();
          batch.set(notiRef, {
            targetUserName: recipientName, // 받는 사람
            fromUserName: userName, // 보낸 사람
            type: "daily", // 알림 타입
            message: `${userName}님이 일일 업무 보고서를 작성했습니다.`,
            link: `/main/work/daily/${docRef.id}`, // 클릭 시 이동 경로
            isRead: false,
            createdAt: Date.now(),
          });
        });

        await batch.commit();
        console.log(`[Notification] Sent to ${recipients.length} people.`);
      }
    }

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
