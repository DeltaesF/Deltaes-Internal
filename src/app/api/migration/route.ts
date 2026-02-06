// /api/migration/route.ts
import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ✅ 빌드 시 에러를 방지하기 위해 초기화 로직을 반드시 포함해야 합니다.
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
    // 처리할 컬렉션 목록
    const collections = [
      "userDailys",
      "userWeeklys",
      "userReports",
      "userApprovals",
      "requests",
    ];
    let totalUpdated = 0;

    for (const colName of collections) {
      const snapshot = await db.collectionGroup(colName).get();

      const promises = snapshot.docs.map(async (doc) => {
        const data = doc.data();
        if (!data.id) {
          await doc.ref.update({ id: doc.id });
          return true;
        }
        return false;
      });

      const results = await Promise.all(promises);
      totalUpdated += results.filter((updated) => updated).length;
    }

    return NextResponse.json({
      message: "모든 컬렉션 마이그레이션 완료",
      totalUpdated,
    });
  } catch (error: unknown) {
    console.error("Update Error:", error);
    // [수정] 에러 타입 가드 적용 (any 사용 방지)
    const errorMessage =
      error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
