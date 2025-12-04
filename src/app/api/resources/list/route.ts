import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

export async function GET() {
  try {
    // [중요] collectionGroup을 사용해야 하위 컬렉션(userReports)을 모두 뒤져서 가져옵니다.
    // 주의: orderBy를 사용하려면 Firestore 콘솔에서 '색인(Index)'을 만들어야 할 수도 있습니다.
    // 색인 에러가 나면 터미널에 뜨는 URL을 클릭해서 생성해주세요.
    const snapshot = await db
      .collectionGroup("userResources")
      .orderBy("createdAt", "desc") // 최신순 정렬
      .get();

    const list = snapshot.docs.map((doc) => {
      const data = doc.data();
      // 데이터 변환: createdAt이 Timestamp 객체일 경우 숫자로 변환 (필요시)
      return {
        id: doc.id,
        title: data.title || "제목 없음",
        content: data.content || "",
        userName: doc.data().userName,
        fileUrl: data.fileUrl || null,
        fileName: data.fileName || null,
        // createdAt이 Firestore Timestamp라면 toMillis() 사용, 숫자라면 그대로 사용
        createdAt:
          data.createdAt && typeof data.createdAt.toMillis === "function"
            ? data.createdAt.toMillis()
            : data.createdAt,
      };
    });

    console.log(`[API] 조회된 보고서 개수: ${list.length}`); // 서버 로그 확인용

    return NextResponse.json(list);
  } catch (error: unknown) {
    console.error("[API Error] Failed to load reports:", error);
    // 에러 타입 가드 (Type Guard)
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
