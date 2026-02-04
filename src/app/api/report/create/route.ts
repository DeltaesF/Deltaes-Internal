import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { sendEmail } from "@/lib/nodemailer";

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

interface ApproverStructure {
  first: string[];
  second: string[];
  third: string[];
  shared: string[];
}

interface ApprovalHistoryEntry {
  approver: string;
  status: string;
  comment: string;
  approvedAt: Date | FieldValue;
}

interface ReportData {
  reportType: string;
  title: string;
  content: string;
  userName: string;
  department: string;
  position: string;
  approvers: ApproverStructure;
  status: string;
  createdAt: FieldValue;
  approvalHistory: ApprovalHistoryEntry[];

  fileUrl?: string | null;
  fileName?: string | null;
  attachments?: { name: string; url: string }[];

  educationName?: string | null;
  educationPeriod?: string | null;
  educationPlace?: string | null;
  educationTime?: string | null;
  usefulness?: string | null;

  docNumber?: string | null;
  tripDestination?: string | null;
  tripCompanions?: string | null;
  tripPeriod?: string | null;
  tripExpenses?: { date: string; detail: string }[] | null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      userName,
      title,
      content,
      fileUrl,
      fileName,
      attachments,
      reportType = "general",
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
      approvers: bodyApprovers,
    } = body;

    if (!userName || !title) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    // 1. 결재선 정보 조회
    let rawApprovers = bodyApprovers;
    let department = "";
    let position = "";

    if (!rawApprovers) {
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
      rawApprovers = empData.recipients?.report || empData.recipients?.approval;
      department = empData.department || "";
      position = empData.role || "";
    }

    // 결재선 구조 변환 (배열 -> 객체)
    const structuredApprovers: ApproverStructure = {
      first: [],
      second: [],
      third: [],
      shared: [],
    };

    if (Array.isArray(rawApprovers)) {
      if (rawApprovers[0]) structuredApprovers.first = [rawApprovers[0]];
      if (rawApprovers[1]) structuredApprovers.second = [rawApprovers[1]];
      if (rawApprovers[2]) structuredApprovers.third = [rawApprovers[2]];
    } else if (rawApprovers && typeof rawApprovers === "object") {
      const ra = rawApprovers as ApproverStructure;
      if (ra.first) structuredApprovers.first = ra.first;
      if (ra.second) structuredApprovers.second = ra.second;
      if (ra.third) structuredApprovers.third = ra.third;
      if (ra.shared) structuredApprovers.shared = ra.shared;
    }

    // 2. 저장할 데이터 객체 구성
    const docData: ReportData = {
      reportType,
      title,
      content,
      userName,
      department,
      position,
      approvers: structuredApprovers,
      status: "1차 결재 대기",
      createdAt: FieldValue.serverTimestamp(),
      approvalHistory: [],
    };

    if (reportType === "business_trip") {
      docData.docNumber = docNumber || null;
      docData.tripDestination = tripDestination || null;
      docData.tripCompanions = tripCompanions || null;
      docData.tripPeriod = tripPeriod || null;
      docData.tripExpenses = tripExpenses || [];
      docData.attachments = attachments || [];
      docData.fileUrl = fileUrl || null;
      docData.fileName = fileName || null;
    } else if (reportType === "internal_edu" || reportType === "external_edu") {
      docData.educationName = educationName || null;
      docData.educationPeriod = educationPeriod || null;
      docData.educationPlace = educationPlace || null;
      docData.educationTime = educationTime || null;
      docData.usefulness = usefulness || null;
      docData.attachments = attachments || [];
    }

    // 3. DB 저장
    const docRef = db
      .collection("reports")
      .doc(userName)
      .collection("userReports")
      .doc();

    await docRef.set(docData);

    // -------------------------------------------------------------
    // [4] 🔔 알림 및 이메일 발송
    // -------------------------------------------------------------
    const batch = db.batch();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    // ✅ [수정] 보고서 타입에 따라 상세 페이지 경로 동적 생성 (이제 이 변수가 사용됩니다!)
    let pathSegment = "internal";
    if (reportType === "business_trip") pathSegment = "business";
    else if (reportType === "external_edu") pathSegment = "external";

    const detailPath = `/main/report/${pathSegment}/edit/${docRef.id}`;

    const notifyGroup = async (
      targetUsers: string[],
      mailSubject: string,
      mailHeader: string,
      mailMessage: string,
      linkPath: string,
      isApprovalRequest: boolean,
      sendDbNotification: boolean
    ) => {
      if (!targetUsers || targetUsers.length === 0) return;

      await Promise.all(
        targetUsers.map(async (targetName) => {
          if (sendDbNotification) {
            const notiRef = db
              .collection("notifications")
              .doc(targetName)
              .collection("userNotifications")
              .doc();
            batch.set(notiRef, {
              targetUserName: targetName,
              fromUserName: userName,
              type: "report",
              message: `[${title}] ${mailHeader}`,
              link: isApprovalRequest ? "/main/my-approval/pending" : linkPath,
              isRead: false,
              createdAt: Date.now(),
              reportId: docRef.id,
            });
          }

          const userQuery = await db
            .collection("employee")
            .where("userName", "==", targetName)
            .get();
          if (!userQuery.empty) {
            const email = userQuery.docs[0].data().email;
            if (email) {
              await sendEmail({
                to: email,
                subject: mailSubject,
                html: `
                  <div style="padding: 20px; border: 1px solid #ddd; border-radius: 10px; font-family: sans-serif;">
                    <h2 style="color: #2c3e50;">${mailHeader}</h2>
                    <p style="font-size: 16px; line-height: 1.5;">${mailMessage}</p>
                    <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                      <p style="margin: 5px 0;"><strong>기안자:</strong> ${userName} (${department})</p>
                      <p style="margin: 5px 0;"><strong>제목:</strong> ${title}</p>
                    </div>
                    <a href="${baseUrl}${linkPath}" 
                       style="display: inline-block; padding: 12px 24px; background-color: #519d9e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">
                       ${
                         isApprovalRequest ? "결재하러 가기" : "보고서 확인하기"
                       }
                    </a>
                  </div>
                `,
              });
            }
          }
        })
      );
    };

    // [A] 1차 결재자 알림
    await notifyGroup(
      structuredApprovers.first,
      `[결재요청] ${title}`,
      "보고서 결재 요청이 도착했습니다.",
      `${userName} 작성한 보고서의 1차 결재 차례입니다.`,
      "/main/my-approval/pending",
      true,
      true
    );

    const shared = [
      // ...structuredApprovers.second, // ❌ 제거: 2차 결재자는 자기 차례에 받음
      // ...structuredApprovers.third,  // ❌ 제거: 3차 결재자는 자기 차례에 받음
      ...structuredApprovers.shared, // ⭕ 유지: 순수 참조자만 받음
    ];

    // 혹시라도 1차 결재자가 공유자에 중복되어 있으면 제외
    const uniqueShared = [...new Set(shared)].filter(
      (u) => !structuredApprovers.first.includes(u)
    );

    // detailPath 변수 사용 (Unused variable 해결됨)
    await notifyGroup(
      uniqueShared,
      `[공유] ${title}`,
      "보고서가 공유되었습니다.",
      `${userName} 작성한 보고서가 공유되었습니다.`,
      detailPath,
      false,
      true
    );

    await batch.commit();

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error("Report Create Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
