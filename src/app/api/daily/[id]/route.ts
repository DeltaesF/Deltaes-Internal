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

    // ✅ [최적화 완료] 인덱스를 통해 문서 딱 1개만 정밀 타격해서 읽습니다. (읽기 1회)
    const snapshot = await db
      .collectionGroup("userDailys")
      .where("id", "==", id)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const doc = snapshot.docs[0];
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
