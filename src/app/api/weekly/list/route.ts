import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Query } from "firebase-admin/firestore"; // [수정] Query 타입 import

// Firebase Admin 초기화 (기존 코드 유지)
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
    // [수정] department는 아직 사용하지 않으므로 제거 (unused-vars 에러 해결)
    const { userName, role, page = 1, limit = 18 } = await req.json();

    // [수정] 변수 타입을 Query로 명시 (CollectionGroup vs Query 타입 불일치 에러 해결)
    let query: Query = db.collectionGroup("userWeeklys");

    // ✅ [수정] 슈퍼바이저 또는 관리자는 모든 게시물 열람 가능
    if (role === "supervisor" || role === "admin") {
      query = query.orderBy("createdAt", "desc");
    }
    // 2. 그 외 사용자는 본인 것만 열람
    else {
      query = query
        .where("userName", "==", userName)
        .orderBy("createdAt", "desc");
    }

    // 2. 전체 개수 조회 (페이지네이션 계산용)
    // count() 쿼리는 데이터를 다 가져오지 않아 비용이 저렴합니다.
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    // 3. 페이지네이션 적용 (offset, limit)
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
        createdAt:
          data.createdAt && typeof data.createdAt.toMillis === "function"
            ? data.createdAt.toMillis()
            : data.createdAt || Date.now(),
      };
    });

    // ✅ list와 totalCount를 함께 반환
    return NextResponse.json({ list, totalCount });
  } catch (error: unknown) {
    // [수정] error 타입을 unknown으로 변경하고 타입 가드 사용 (no-explicit-any 에러 해결)
    console.error("Error fetching dailys:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
