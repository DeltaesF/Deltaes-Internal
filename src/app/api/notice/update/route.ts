import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Firebase Admin 초기화 (기존 코드와 동일)
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
    const { id, userName, title, content, fileUrl, fileName } =
      await req.json();

    // 1. 필수 값 검증
    if (!id || !userName || !title || !content) {
      return NextResponse.json(
        { error: "필수 정보가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 2. 문서 경로 참조
    // 중요: create 로직과 동일하게 'notice' -> userName -> 'userNotices' 순서여야 합니다.
    const docRef = db
      .collection("notice")
      .doc(userName)
      .collection("userNotices")
      .doc(id);

    // 3. 문서 존재 여부 확인
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "해당 공지사항을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 4. (선택사항) 본인 확인 로직
    // 클라이언트에서 userName을 보내주지만, DB 데이터와 일치하는지 한 번 더 체크하면 안전합니다.
    if (doc.data()?.userName !== userName) {
      return NextResponse.json(
        { error: "수정 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 5. 업데이트 데이터 구성
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      title,
      content,
      updatedAt: FieldValue.serverTimestamp(), // 수정 시간 기록
    };

    // 파일이 새로 업로드된 경우에만 파일 정보 업데이트
    if (fileUrl) {
      updateData.fileUrl = fileUrl;
      updateData.fileName = fileName;
    }

    // 6. DB 업데이트 수행
    await docRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("공지사항 수정 중 오류 발생:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
