import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendEmail } from "@/lib/nodemailer";

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

// ✅ [추가] 결재선 구조 인터페이스
interface ApproverStructure {
  first: string[];
  second: string[];
  third: string[];
  shared: string[];
}

interface VacationRequestBody {
  userDocId: string;
  startDate: string;
  endDate: string;
  types: string[];
  days: number;
  reason: string;
  // ✅ [수정] 배열이나 객체 둘 다 들어올 수 있게 처리
  approvers: string[] | ApproverStructure;
  userName: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: VacationRequestBody = await req.json();
    const {
      userDocId,
      startDate,
      endDate,
      types,
      days,
      reason,
      approvers: rawApprovers, // raw 데이터로 받음
      userName,
    } = body;

    const vacationRef = db.collection("vacation").doc(userDocId);

    // ----------------------------------------------------------------
    // ✅ [핵심 수정] 결재선 구조 변환 (배열 -> 객체) - 안전장치 추가
    // ----------------------------------------------------------------
    const structuredApprovers: ApproverStructure = {
      first: [],
      second: [],
      third: [],
      shared: [],
    };

    if (Array.isArray(rawApprovers)) {
      // 배열로 들어온 경우 (예전 방식) -> 순서대로 매핑
      if (rawApprovers[0]) structuredApprovers.first = [rawApprovers[0]];
      if (rawApprovers[1]) structuredApprovers.second = [rawApprovers[1]];
      if (rawApprovers[2]) structuredApprovers.third = [rawApprovers[2]];
    } else if (rawApprovers && typeof rawApprovers === "object") {
      // 객체로 들어온 경우 -> 그대로 매핑
      const ra = rawApprovers as ApproverStructure;
      if (ra.first) structuredApprovers.first = ra.first;
      if (ra.second) structuredApprovers.second = ra.second;
      if (ra.third) structuredApprovers.third = ra.third;
      if (ra.shared) structuredApprovers.shared = ra.shared;
    }

    // 1. 휴가 신청 문서 생성
    const newDocRef = await vacationRef.collection("requests").add({
      startDate,
      endDate,
      types,
      daysUsed: days,
      reason,
      status: "1차 결재 대기",
      approvers: structuredApprovers, // ✅ 변환된 객체로 저장
      userName,
      approvalStep: 0,
      createdAt: FieldValue.serverTimestamp(),
      createdDate: getTodayString(),
      approvalHistory: [], // ✅ 이력 초기화
    });

    const vacationId = newDocRef.id;

    // 2. 알림 및 이메일 발송
    const batch = db.batch();
    const todayStr = getTodayString();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    // 공통 발송 함수
    const notifyGroup = async (
      targetUsers: string[],
      mailSubject: string,
      mailHeader: string,
      mailMessage: string,
      dbMessage: string,
      linkPath: string,
      isApprovalRequest: boolean,
      sendDbNotification: boolean
    ) => {
      if (!targetUsers || targetUsers.length === 0) return;

      await Promise.all(
        targetUsers.map(async (targetName) => {
          // 1. DB 알림 저장
          if (sendDbNotification) {
            const notiRef = db
              .collection("notifications")
              .doc(targetName)
              .collection("userNotifications")
              .doc();

            batch.set(notiRef, {
              targetUserName: targetName,
              fromUserName: userName,
              type: isApprovalRequest ? "vacation_request" : "vacation",
              message: dbMessage,
              link: linkPath,
              isRead: false,
              createdAt: Date.now(),
              createdDate: todayStr,
              vacationId: vacationId,
            });
          }

          // 2. 이메일 발송
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
                      <p style="margin: 5px 0;"><strong>신청자:</strong> ${userName}</p>
                      <p style="margin: 5px 0;"><strong>기간:</strong> ${startDate} ~ ${endDate} (${days}일)</p>
                      <p style="margin: 5px 0;"><strong>사유:</strong> ${reason}</p>
                    </div>

                    <a href="${baseUrl}${linkPath}" 
                       style="display: inline-block; padding: 12px 24px; background-color: #519d9e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">
                       ${isApprovalRequest ? "결재하러 가기" : "내역 확인하기"}
                    </a>
                  </div>
                `,
              });
            }
          }
        })
      );
    };

    // [A] 1차 결재자 (결재 요청)
    // ✅ structuredApprovers 사용
    await notifyGroup(
      structuredApprovers.first,
      `[결재요청] ${userName} - 휴가 신청`,
      "휴가 결재 요청이 도착했습니다.",
      `${userName}님의 휴가 신청 건입니다.<br/>내용을 확인하시고 결재를 진행해주세요.`,
      `[결재요청] ${userName} - 휴가 신청 (1차 대기)`,
      "/main/my-approval/pending",
      true,
      true
    );

    // [B] 참조/공유자
    // ✅ structuredApprovers 사용
    const referenceUsers: string[] = [
      ...(structuredApprovers.second || []),
      ...(structuredApprovers.third || []),
      ...(structuredApprovers.shared || []),
    ];

    const uniqueRefs = [...new Set(referenceUsers)].filter(
      (u: string) => !structuredApprovers.first.includes(u)
    );

    await notifyGroup(
      uniqueRefs,
      `[공유] ${userName} - 휴가 신청`,
      "휴가 신청이 공유되었습니다.",
      `${userName}님의 휴가 신청 내역입니다.<br/>(진행 상황을 공유합니다.)`,
      `[공유] ${userName} - 휴가 신청`,
      "/main/my-approval/shared",
      false,
      true
    );

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("휴가 신청 오류:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
