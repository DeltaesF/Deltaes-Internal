import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Query } from "firebase-admin/firestore";

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
    // ✅ 클라이언트에서 보낸 page, limit, filterType 수신
    const {
      userName,
      page = 1,
      limit = 12,
      filterType = "all",
    } = await req.json();

    if (!userName) {
      return NextResponse.json({ list: [], totalCount: 0 });
    }

    // 1. 기본 쿼리 (내 알림 목록)
    let query: Query = db
      .collection("notifications")
      .doc(userName)
      .collection("userNotifications");

    // 2. ✅ 서버 사이드 필터링
    if (filterType !== "all") {
      if (filterType === "vacation") {
        query = query.where("type", "in", [
          "vacation",
          "vacation_request",
          "vacation_complete",
          "vacation_reject",
        ]);
      } else {
        query = query.where("type", "==", filterType);
      }
    }

    // 3. 정렬 (최신순)
    query = query.orderBy("createdAt", "desc");

    // 4. ✅ 전체 개수 조회
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    // 5. ✅ 페이지네이션 적용하여 데이터 조회
    const offset = (page - 1) * limit;
    const snapshot = await query.limit(limit).offset(offset).get();

    const list = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        targetUserName: userName,
        fromUserName: data.fromUserName,
        type: data.type,
        message: data.message,
        link: data.link,
        isRead: data.isRead,

        // ✅ [핵심 수정] DB에 저장된 ID들을 꺼내서 전달
        vacationId: data.vacationId || null,
        approvalId: data.approvalId || null, // 품의서 ID
        reportId: data.reportId || null, // 보고서 ID

        createdAt:
          data.createdAt && typeof data.createdAt.toMillis === "function"
            ? data.createdAt.toMillis()
            : data.createdAt || Date.now(),
      };
    });

    return NextResponse.json({ list, totalCount });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
