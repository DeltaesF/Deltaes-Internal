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
      reportType,
      // 교육 보고서 관련 필드
      educationName,
      educationPeriod,
      educationPlace,
      educationTime,
      usefulness,
      // 외근/차량 보고서 관련 필드
      contact,
      purpose,
      isExternalWork,
      isVehicleUse,
      implementDate,
      vehicleModel,
      usagePeriod,
    } = body;

    if (!userName || !title) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    // 1. 작성자의 결재선 정보 가져오기
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
      reportType: reportType || "general",
      title,
      content,
      userName,
      department: empData.department || "",
      position: empData.role || "",
      // 교육 관련 필드
      educationName: educationName || null,
      educationPeriod: educationPeriod || null,
      educationPlace: educationPlace || null,
      educationTime: educationTime || null,
      usefulness: usefulness || null,

      // 차량/외근 필드
      contact: contact || null,
      purpose: purpose || null,
      isExternalWork: isExternalWork || false,
      isVehicleUse: isVehicleUse || false,
      implementDate: implementDate || null,
      vehicleModel: vehicleModel || null,
      usagePeriod: usagePeriod || null,

      approvers: reportLine,
      status: "1차 결재 대기",
      createdAt: FieldValue.serverTimestamp(),
    });

    // 3. [알림] 결재자(요청) + 나머지(참조) 발송
    const batch = db.batch();

    // -------------------------------------------------------------
    // [A] 1차 결재자 (결재 요청)
    // -------------------------------------------------------------
    const firstApprovers: string[] = reportLine.first || [];
    firstApprovers.forEach((approver) => {
      const notiRef = db
        .collection("notifications")
        .doc(approver)
        .collection("userNotifications")
        .doc();
      batch.set(notiRef, {
        targetUserName: approver,
        fromUserName: userName,
        type: "report",
        message: `[${title}] 결재 요청이 도착했습니다.`,
        link: `/main/my-approval/pending`, // 결재 대기함으로 이동
        isRead: false,
        createdAt: Date.now(),
        reportId: docRef.id,
      });
    });

    // -------------------------------------------------------------
    // [B] 2차, 3차 결재자 + 공유자 (참조 알림)
    // -------------------------------------------------------------
    const referenceUsers = [
      ...(reportLine.second || []),
      ...(reportLine.third || []),
      ...(reportLine.shared || []),
    ];

    // 중복 제거
    const uniqueRefs = [...new Set(referenceUsers)];

    uniqueRefs.forEach((targetName: string) => {
      // 1차 결재자와 겹치면 제외 (이미 보냈으므로)
      if (firstApprovers.includes(targetName)) return;

      const notiRef = db
        .collection("notifications")
        .doc(targetName)
        .collection("userNotifications")
        .doc();

      batch.set(notiRef, {
        targetUserName: targetName,
        fromUserName: userName,
        type: "report",
        message: `[공유/예정] ${title} 결재 요청이 도착했습니다.`,
        link: `/main/report/${docRef.id}`, // 보고서 상세 페이지로 바로 이동
        isRead: false,
        createdAt: Date.now(),
        reportId: docRef.id,
      });
    });

    await batch.commit();

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
