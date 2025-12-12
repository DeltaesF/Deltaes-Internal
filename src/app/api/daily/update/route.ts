import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, DocumentReference } from "firebase-admin/firestore"; // [수정] DocumentReference 추가

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

// [수정] DB에 저장되는 문서의 전체 구조 정의 (인터페이스)
interface DailyReport {
  title: string;
  content: string;
  userName?: string; // 업데이트 시에는 필요 없지만 문서 구조상 존재
  fileUrl?: string | null;
  fileName?: string | null;
  createdAt?: number; // 생성일
  updatedAt: number; // 수정일
}

export async function POST(req: Request) {
  try {
    const { id, userName, title, content, fileUrl, fileName } =
      await req.json();

    if (!id || !userName || !title || !content) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    // [수정] docRef에 제네릭 타입(<DailyReport>) 지정
    // 이렇게 하면 update 메서드가 DailyReport 타입에 맞는 필드만 받도록 동작합니다.
    const docRef = db
      .collection("dailys")
      .doc(userName)
      .collection("userDailys")
      .doc(id) as DocumentReference<DailyReport>;

    // [수정] Partial<DailyReport> 사용
    // any를 쓰지 않고도, DailyReport의 필드 중 일부만 포함하는 객체임을 명시합니다.
    const updateData: Partial<DailyReport> = {
      title,
      content,
      updatedAt: Date.now(),
    };

    // 파일이 새로 첨부된 경우에만 업데이트 객체에 추가
    if (fileUrl) {
      updateData.fileUrl = fileUrl;
      updateData.fileName = fileName;
    }

    await docRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Update Error:", error);
    // [수정] 에러 타입 가드 적용 (any 사용 방지)
    const errorMessage =
      error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
