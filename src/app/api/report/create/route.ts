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

// ✅ [추가] 보고서 데이터 타입 정의 (any 제거용)
interface ReportData {
  reportType: string;
  title: string;
  content: string;
  userName: string;
  department: string;
  position: string;
  approvers: {
    first: string[];
    second: string[];
    third: string[];
    shared: string[];
  };
  status: string;
  createdAt: FieldValue;
  // 🔹 교육용 선택 필드
  educationName?: string | null;
  educationPeriod?: string | null;
  educationPlace?: string | null;
  educationTime?: string | null;
  usefulness?: string | null;

  // 🆕 출장 보고서용 필드
  docNumber?: string | null; // 문서 번호
  tripDestination?: string | null; // 출장지
  tripCompanions?: string | null; // 동행출장자
  tripPeriod?: string | null; // 출장 기간
  tripExpenses?: { date: string; detail: string }[] | null; // 출장 경비 (배열)
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      userName,
      title,
      content,
      reportType = "general", // 기본값
      // 교육 보고서 관련 필드
      educationName,
      educationPeriod,
      educationPlace,
      educationTime,
      usefulness,
      docNumber,
      tripDestination,
      tripCompanions,
      tripPeriod,
      tripExpenses,
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

    // 2. ✅ [수정] 저장할 데이터 객체 동적 구성
    // 공통 필드 먼저 정의
    const docData: ReportData = {
      reportType,
      title,
      content,
      userName,
      department: empData.department || "",
      position: empData.role || "",
      approvers: reportLine,
      status: "1차 결재 대기",
      createdAt: FieldValue.serverTimestamp(),
    };

    //  교육 보고서일 때만 추가 (내부/외부)

    if (reportType === "business_trip") {
      docData.docNumber = docNumber || null;
      docData.tripDestination = tripDestination || null;
      docData.tripCompanions = tripCompanions || null;
      docData.tripPeriod = tripPeriod || null;
      docData.tripExpenses = tripExpenses || [];
    } else if (reportType === "internal_edu" || reportType === "external_edu") {
      docData.educationName = educationName || null;
      docData.educationPeriod = educationPeriod || null;
      docData.educationPlace = educationPlace || null;
      docData.educationTime = educationTime || null;
      docData.usefulness = usefulness || null;
    }

    // 3. DB 저장
    const docRef = db
      .collection("reports")
      .doc(userName)
      .collection("userReports")
      .doc();

    await docRef.set(docData);

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
