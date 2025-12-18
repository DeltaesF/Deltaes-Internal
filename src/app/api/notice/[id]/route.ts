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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // [중요] userNotices 컬렉션 전체에서 해당 ID를 가진 문서를 찾습니다.
    const snapshot = await db.collectionGroup("userNotices").get();
    const doc = snapshot.docs.find((d) => d.id === id);

    if (!doc) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const data = doc.data();

    // 데이터 포맷팅 (날짜 등)
    const responseData = {
      id: doc.id,
      title: data.title || "제목 없음",
      content: data.content || "",
      userName: data.userName || "작성자",
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      createdAt:
        data.createdAt && typeof data.createdAt.toMillis === "function"
          ? data.createdAt.toMillis()
          : data.createdAt || Date.now(),
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error fetching weekly detail:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
