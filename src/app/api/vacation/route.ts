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

// ✅ [추가] 오늘 날짜를 "YYYY-MM-DD" 문자열로 반환하는 함수
function getTodayString() {
  const date = new Date();
  // 한국 시간(KST) 보정 (필요 시) - 서버 설정에 따라 다르지만 보통 이렇게 하면 됨
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

    // 1. 휴가 신청 문서 생성 (여기 createdAt은 Firestore Timestamp로 유지 권장)
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
      createdAt: FieldValue.serverTimestamp(), // DB 정렬용
      createdDate: getTodayString(), // ✅ [추가] 보기 편한 날짜 ("2026-01-05")
    });

    const vacationId = newDocRef.id;

    // 2. [알림] 1차 결재자들에게 발송
    if (approvers.first && approvers.first.length > 0) {
      const batch = db.batch();
      const firstApprovers: string[] = approvers.first;

      // ✅ 오늘 날짜 문자열 생성
      const todayStr = getTodayString();

      for (const approverName of firstApprovers) {
        const notiRef = db
          .collection("notifications")
          .doc(approverName)
          .collection("userNotifications")
          .doc();

        batch.set(notiRef, {
          targetUserName: approverName,
          fromUserName: userName,
          type: "vacation_request",
          message: `${userName} 휴가 결재 요청이 있습니다.`,
          link: `/main/my-approval/pending`,
          isRead: false,

          // ✨ [수정 포인트]
          createdAt: Date.now(), // 정렬용 (숫자 유지: 1767...)
          createdDate: todayStr, // ✅ 읽기용 (문자열 추가: "2026-01-05")

          vacationId: vacationId, // 취소 시 삭제를 위해 필요
        });
      }
      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("휴가 신청 오류:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
