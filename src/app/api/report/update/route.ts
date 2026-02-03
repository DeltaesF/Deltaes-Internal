import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore"; // [수정] DocumentReference 제거
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

// 업데이트할 데이터의 타입 정의
interface UpdatePayload {
  title: string;
  content: string;
  updatedAt: FieldValue;

  // ✅ [추가] 상태 변경용
  status?: string;

  // 교육 보고서 관련 필드
  educationName?: string;
  educationPeriod?: string;
  educationPlace?: string;
  educationTime?: string;
  usefulness?: string;

  tripDestination?: string;
  tripCompanions?: string;
  tripPeriod?: string;
  tripExpenses?: { date: string; detail: string }[];

  attachments?: { name: string; url: string }[];
  fileUrl?: string;
  fileName?: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      userName,

      // ✅ [추가] 상태 및 코멘트
      status,

      title,
      content,
      educationName,
      educationPeriod,
      educationPlace,
      educationTime,
      usefulness,
      tripDestination,
      tripCompanions,
      tripPeriod,
      tripExpenses,
      fileUrl,
      fileName,
      attachments,
    } = body;

    if (!id || !userName || !title) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    // 보고서 경로 찾기: reports/{userName}/userReports/{id}
    const docRef = db
      .collection("reports")
      .doc(userName)
      .collection("userReports")
      .doc(id);

    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 작성자 본인 확인
    if (doc.data()?.userName !== userName) {
      return NextResponse.json(
        { error: "수정 권한이 없습니다." },
        { status: 403 }
      );
    }

    const currentData = doc.data();

    // ✅ [수정] any 대신 UpdatePayload 타입 사용
    const updateData: UpdatePayload = {
      title,
      content,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // ✅ 상태 변경이 있다면 업데이트에 포함
    if (status) {
      updateData.status = status;
    }

    // ✅ 값이 있는 경우에만 필드 추가 (undefined 체크)
    // 교육 보고서 필드 업데이트
    if (educationName !== undefined) updateData.educationName = educationName;
    if (educationPeriod !== undefined)
      updateData.educationPeriod = educationPeriod;
    if (educationPlace !== undefined)
      updateData.educationPlace = educationPlace;
    if (educationTime !== undefined) updateData.educationTime = educationTime;
    if (usefulness !== undefined) updateData.usefulness = usefulness;
    // 출장 보고서 필드 업데이트
    if (tripDestination !== undefined)
      updateData.tripDestination = tripDestination;
    if (tripCompanions !== undefined)
      updateData.tripCompanions = tripCompanions;
    if (tripPeriod !== undefined) updateData.tripPeriod = tripPeriod;
    if (tripExpenses !== undefined) updateData.tripExpenses = tripExpenses;
    // 파일 업데이트
    if (currentData?.reportType === "business_trip") {
      // 다중 파일
      if (attachments !== undefined) {
        updateData.attachments = attachments;
      }
      // 단일 파일 (하위 호환)
      if (fileUrl) {
        updateData.fileUrl = fileUrl;
        updateData.fileName = fileName;
      }
    }

    await docRef.update({ ...updateData });

    // ----------------------------------------------------------------
    // [5] 🔔 결재 단계별 알림 및 이메일 발송 (상태 변경 시에만 실행)
    // ----------------------------------------------------------------
    if (status) {
      const batch = db.batch();
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      const approvers = currentData?.approvers || {
        first: [],
        second: [],
        third: [],
      };
      const drafter = currentData?.userName; // 기안자
      // 제목은 수정된 제목(title)이 있으면 그걸 쓰고, 없으면 기존 제목(currentData.title) 사용
      const docTitle = title || currentData?.title || "제목 없음";

      // ✅ 공통 알림/메일 발송 함수 (코멘트 제외됨)
      const notifyAndEmail = async (
        targetUsers: string[],
        subject: string,
        message: string,
        link: string,
        isActionRequired: boolean,
        sendDbNotification: boolean // 👈 DB 알림 여부 (결재자는 false, 기안자는 true)
      ) => {
        if (!targetUsers || targetUsers.length === 0) return;

        await Promise.all(
          targetUsers.map(async (targetName) => {
            // 1. DB 알림 저장 (옵션이 true일 때만)
            if (sendDbNotification) {
              const notiRef = db
                .collection("notifications")
                .doc(targetName)
                .collection("userNotifications")
                .doc();
              batch.set(notiRef, {
                targetUserName: targetName,
                fromUserName: "ERP System",
                type: "report", // 타입: 보고서
                message: `[${docTitle}] ${message}`,
                link: link,
                isRead: false,
                createdAt: Date.now(),
                reportId: id,
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
                  subject: subject,
                  html: `
                    <div style="padding: 20px; border: 1px solid #ddd; border-radius: 10px; font-family: sans-serif;">
                      <h2 style="color: #2c3e50;">${message}</h2>
                      <p><strong>보고서 제목:</strong> ${docTitle}</p>
                      <p><strong>작성자:</strong> ${drafter}</p>
                      <br/>
                      <a href="${baseUrl}${link}" 
                         style="display: inline-block; padding: 12px 24px; background-color: #519d9e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                         ${isActionRequired ? "결재하러 가기" : "확인하기"}
                      </a>
                      <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;" />
                      <p style="font-size: 12px; color: #999;">본 메일은 델타이에스 ERP 시스템에서 자동 발송되었습니다.</p>
                    </div>
                  `,
                });
              }
            }
          })
        );
      };

      // 🔄 상태(Status)에 따른 타겟 설정

      // Case 1: 1차 승인됨 -> 2차 결재자에게 알림 (이메일 O, DB알림 X)
      if (status.includes("2차 결재 대기") || status === "2차 결재 중") {
        await notifyAndEmail(
          approvers.second,
          `[결재요청] 2차 결재가 필요합니다`,
          "2차 결재 차례입니다.",
          "/main/my-approval/pending",
          true,
          false // 👈 DB 알림 끔
        );
      }

      // Case 2: 2차 승인됨 -> 3차 결재자에게 알림 (이메일 O, DB알림 X)
      else if (status.includes("3차 결재 대기") || status === "3차 결재 중") {
        await notifyAndEmail(
          approvers.third,
          `[결재요청] 3차 결재가 필요합니다`,
          "3차 결재 차례입니다.",
          "/main/my-approval/pending",
          true,
          false // 👈 DB 알림 끔
        );
      }

      // Case 3: 최종 승인 -> 기안자에게 알림 (이메일 O, DB알림 O)
      else if (status === "결재 완료" || status === "승인") {
        await notifyAndEmail(
          [drafter],
          `[승인완료] ${docTitle}`,
          "보고서가 최종 승인되었습니다.",
          `/main/report/${id}`,
          false,
          true // 👈 DB 알림 켬 (결과 확인용)
        );
      }

      // Case 4: 반려 -> 기안자에게 알림 (이메일 O, DB알림 O)
      else if (status.includes("반려")) {
        await notifyAndEmail(
          [drafter],
          `[반려] ${docTitle}`,
          "보고서가 반려되었습니다.",
          `/main/report/${id}`,
          false,
          true // 👈 DB 알림 켬 (결과 확인용)
        );
      }

      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Report Update Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
