import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

function getTodayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userDocId,
      startDate,
      endDate,
      types,
      days,
      reason,
      approvers,
      userName,
    } = body;

    const vacationRef = db.collection("vacation").doc(userDocId);

    // 1. 휴가 신청 문서 생성
    const newDocRef = await vacationRef.collection("requests").add({
      startDate,
      endDate,
      types,
      daysUsed: days,
      reason,
      status: "1차 결재 대기",
      approvers,
      userName,
      approvalStep: 0,
      createdAt: FieldValue.serverTimestamp(),
      createdDate: getTodayString(),
    });

    const vacationId = newDocRef.id;

    // ✅ [수정] 알림 발송 로직 (전체 발송)
    const batch = db.batch();
    const todayStr = getTodayString();

    // -------------------------------------------------------------
    // [A] 1차 결재자 (실제 결재 요청)
    // -------------------------------------------------------------
    if (approvers.first && approvers.first.length > 0) {
      approvers.first.forEach((approverName: string) => {
        const notiRef = db
          .collection("notifications")
          .doc(approverName)
          .collection("userNotifications")
          .doc();

        batch.set(notiRef, {
          targetUserName: approverName,
          fromUserName: userName,
          type: "vacation_request", // 결재 요청 타입
          message: `${userName} 휴가 결재 요청이 있습니다.`,
          link: `/main/my-approval/pending`, // 결재함으로 이동
          isRead: false,
          createdAt: Date.now(),
          createdDate: todayStr,
          vacationId: vacationId,
        });
      });
    }

    // -------------------------------------------------------------
    // [B] 2차, 3차 결재자 + 공유자 (참조 알림)
    // -------------------------------------------------------------
    // 2차, 3차 결재자도 미리 내용을 볼 수 있도록 '공유' 형태로 알림을 보냅니다.
    // (아직 본인 결재 순서가 아니므로 pending 함에는 뜨지 않기 때문입니다.)
    const referenceUsers = [
      ...(approvers.second || []),
      ...(approvers.third || []),
      ...(approvers.shared || []),
    ];

    // 중복 제거
    const uniqueRefs = [...new Set(referenceUsers)];

    uniqueRefs.forEach((refName: string) => {
      // 1차 결재자와 겹치면 제외 (이미 보냈으므로)
      if (approvers.first?.includes(refName)) return;

      const notiRef = db
        .collection("notifications")
        .doc(refName)
        .collection("userNotifications")
        .doc();

      batch.set(notiRef, {
        targetUserName: refName,
        fromUserName: userName,
        type: "vacation", // 참조/공유 타입
        message: `[공유/예정] ${userName} 휴가 신청 내역입니다.`,
        link: `/main/my-approval/shared`, // 공유함으로 이동 -> 클릭 시 상세 모달
        isRead: false,
        createdAt: Date.now(),
        createdDate: todayStr,
        vacationId: vacationId,
      });
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("휴가 신청 오류:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
