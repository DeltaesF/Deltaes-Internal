import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Query, Timestamp } from "firebase-admin/firestore";

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
    // ✅ startDate, endDate 추가 수신
    const {
      userName,
      role,
      page = 1,
      limit = 12,
      startDate,
      endDate,
    } = await req.json();

    let query: Query = db.collectionGroup("userDailys");

    // ✅ [중요] 주간 보고서 상세 페이지용 조회 로직 분기
    // startDate와 endDate가 있으면 "특정 주간의 일일 업무"를 찾는 것이므로
    // 관리자(supervisor) 여부와 상관없이 '그 주간 보고서 작성자(userName)'의 데이터만 가져와야 함.
    if (startDate && endDate) {
      // ✅ [중요] 숫자(ms)를 Firestore Timestamp 객체로 변환
      // DB에 createdAt이 숫자로 저장되어 있다면 이 변환은 필요 없지만,
      // 보통 Firestore 기본 저장 방식은 Timestamp 객체입니다.
      const startTs = Timestamp.fromMillis(startDate);
      const endTs = Timestamp.fromMillis(endDate);

      query = query
        .where("userName", "==", userName)
        .where("createdAt", ">=", startTs) // 변환된 객체 사용
        .where("createdAt", "<=", endTs) // 변환된 객체 사용
        .orderBy("createdAt", "asc");
    } else {
      if (role === "supervisor" || role === "admin") {
        query = query.orderBy("createdAt", "desc");
      } else {
        query = query
          .where("userName", "==", userName)
          .orderBy("createdAt", "desc");
      }
    }

    // 카운트 쿼리 (날짜 필터링이 적용된 상태에서 개수 세기)
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    // 페이지네이션 (날짜 검색일 경우 limit을 굳이 크게 잡을 필요 없음)
    const offset = (page - 1) * limit;
    const snapshot = await query.limit(limit).offset(offset).get();

    const list = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || "제목 없음",
        content: data.content || "",
        userName: data.userName,
        fileUrl: data.fileUrl || null,
        fileName: data.fileName || null,
        commentCount: data.commentCount || 0,
        createdAt:
          data.createdAt && typeof data.createdAt.toMillis === "function"
            ? data.createdAt.toMillis()
            : data.createdAt || Date.now(),
      };
    });

    return NextResponse.json({ list, totalCount });
  } catch (error: unknown) {
    console.error("Error fetching dailys:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
