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
  // 파일 관련 필드
  fileUrl?: string | null; // 하위 호환성 (대표 파일 1개)
  fileName?: string | null; // 하위 호환성
  attachments?: { name: string; url: string }[]; // ✅ 다중 파일용
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
      fileUrl,
      fileName,
      attachments,
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
      // 📂 파일 저장은 '출장 보고서'일 때만 수행
      docData.attachments = attachments || [];
      docData.fileUrl = fileUrl || null; // 하위 호환
      docData.fileName = fileName || null; // 하위 호환
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

    // -------------------------------------------------------------
    // [4] 🔔 알림 및 이메일 발송 (수정됨)
    // -------------------------------------------------------------
    const batch = db.batch();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const detailPath = `/main/report/${docRef.id}`; // 상세 페이지 경로

    // ✅ 공통 발송 함수 (Reports 전용)
    const notifyGroup = async (
      targetUsers: string[],
      mailSubject: string,
      mailHeader: string,
      mailMessage: string,
      linkPath: string,
      isApprovalRequest: boolean,
      sendDbNotification: boolean // 👈 DB 알림 여부 제어
    ) => {
      if (!targetUsers || targetUsers.length === 0) return;

      await Promise.all(
        targetUsers.map(async (targetName) => {
          // 1. DB 알림 저장 (옵션 true일 때만)
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
              message: `[${title}] ${mailHeader}`, // 예: "[제목] 결재 요청이..."
              link: isApprovalRequest ? "/main/my-approval/pending" : linkPath,
              isRead: false,
              createdAt: Date.now(),
              reportId: docRef.id,
            });
          }

          // 2. 이메일 발송 (항상 수행)
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
                      <p style="margin: 5px 0;"><strong>기안자:</strong> ${userName} (${
                  empData.department || ""
                })</p>
                      <p style="margin: 5px 0;"><strong>보고서 제목:</strong> ${title}</p>
                      <p style="margin: 5px 0;"><strong>작성일:</strong> ${new Date().toLocaleDateString()}</p>
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

    // -------------------------------------------------------------
    // [A] 1차 결재자 (결재 요청) -> 이메일 O, ERP 알림 X
    // -------------------------------------------------------------
    const firstApprovers: string[] = reportLine.first || [];
    await notifyGroup(
      firstApprovers,
      `[결재요청] ${title}`,
      "보고서 결재 요청이 도착했습니다.",
      `${userName} 작성한 보고서의 1차 결재 차례입니다.<br/>내용을 확인하시고 결재를 진행해주세요.`,
      "/main/my-approval/pending",
      true,
      false // 👈 DB 알림 끄기
    );

    // -------------------------------------------------------------
    // [B] 공유자 (참조 알림) -> 이메일 O, ERP 알림 O
    // -------------------------------------------------------------
    const referenceUsers = [
      ...(reportLine.second || []), // 보고서는 보통 2,3차가 없거나 있어도 전결 규정에 따라 다름. 여기선 참조로 분류됨 (기존 로직 유지)
      ...(reportLine.third || []),
      ...(reportLine.shared || []),
    ];

    // 1차 결재자와 겹치는 사람 제외
    const uniqueRefs = [...new Set(referenceUsers)].filter(
      (u) => !firstApprovers.includes(u)
    );

    await notifyGroup(
      uniqueRefs,
      `[공유] ${title}`,
      "보고서가 공유되었습니다.",
      `${userName} 작성한 보고서가 공유되었습니다.<br/>(또는 예정된 결재 건입니다.)`,
      detailPath, // 상세 페이지로 이동
      false,
      true // 👈 DB 알림 켜기
    );

    await batch.commit();

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
