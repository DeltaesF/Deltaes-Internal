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
    const body = await req.json();
    const {
      userName,
      title,
      content,
      fileUrl,
      fileName,
      reportType, // ✅ 추가: 'internal_edu', 'external_edu', 'vehicle' 등 구분

      // ✅ 사내교육보고서 전용 필드
      educationName,
      educationPeriod,
      educationPlace,
      educationTime,
      usefulness,
    } = body;

    if (!userName || !title) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    // 1. 작성자의 결재선 정보 가져오기 (Recipients의 'report' 라인 사용)
    const employeeQuery = await db
      .collection("employee")
      .where("userName", "==", userName)
      .get();

    if (employeeQuery.empty) {
      return NextResponse.json(
        { error: "사용자 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const empData = employeeQuery.docs[0].data();
    // ✅ 'report' 결재선 가져오기 (없으면 빈 배열)
    const reportLine = empData.recipients?.report || {
      first: [],
      second: [],
      third: [],
      shared: [],
    };

    // 2. DB 저장
    const docRef = db
      .collection("reports")
      .doc(userName)
      .collection("userReports")
      .doc();

    await docRef.set({
      reportType: reportType || "general", // 기본값
      title,
      content, // 교육내용 요약 (에디터 내용)
      userName,
      department: empData.department || "", // 부서 정보 저장
      position: empData.role || "", // 직위 정보 저장 (role을 직위로 가정)

      // 사내교육보고서 필드
      educationName: educationName || null,
      educationPeriod: educationPeriod || null,
      educationPlace: educationPlace || null,
      educationTime: educationTime || null,
      usefulness: usefulness || null,

      fileUrl: fileUrl || null,
      fileName: fileName || null,

      // ✅ 결재선 및 상태 저장 (휴가/결재 시스템과 호환되도록 구조 통일 권장)
      approvers: reportLine,
      status: "1차 결재 대기", // 초기 상태
      createdAt: FieldValue.serverTimestamp(),
    });

    // 3. [알림] 1차 결재자에게 알림 발송
    const firstApprovers: string[] = reportLine.first || [];
    if (firstApprovers.length > 0) {
      const batch = db.batch();
      firstApprovers.forEach((approver) => {
        const notiRef = db
          .collection("notifications")
          .doc(approver)
          .collection("userNotifications")
          .doc();
        batch.set(notiRef, {
          targetUserName: approver,
          fromUserName: userName,
          type: "report", // 알림 타입
          message: `[${title}] 결재 요청이 도착했습니다.`,
          link: `/main/my-approval/pending`, // 결재 대기함으로 이동
          isRead: false,
          createdAt: Date.now(),
          reportId: docRef.id, // 참조 ID
        });
      });
      await batch.commit();
    }

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
