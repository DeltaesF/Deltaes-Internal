import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, DocumentReference } from "firebase-admin/firestore";

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

// 문서 구조 정의
interface WeeklyReport {
  title: string;
  content: string;
  userName?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  createdAt?: number;
  updatedAt: number;
}

export async function POST(req: Request) {
  try {
    const { id, userName, title, content, fileUrl, fileName } =
      await req.json();

    if (!id || !userName || !title || !content) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    // 주간 보고서 경로: weekly/{userName}/userWeeklys/{id}
    const docRef = db
      .collection("weekly")
      .doc(userName)
      .collection("userWeeklys")
      .doc(id) as DocumentReference<WeeklyReport>;

    const updateData: Partial<WeeklyReport> = {
      title,
      content,
      updatedAt: Date.now(),
    };

    if (fileUrl !== undefined) {
      updateData.fileUrl = fileUrl;
      updateData.fileName = fileName;
    }

    await docRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Update Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
