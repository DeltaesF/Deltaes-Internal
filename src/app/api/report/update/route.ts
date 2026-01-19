import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore"; // [수정] DocumentReference 제거

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

// 업데이트할 데이터의 타입 정의
interface UpdatePayload {
  title: string;
  content: string;
  updatedAt: FieldValue;
  // 교육 보고서 관련 필드
  educationName?: string;
  educationPeriod?: string;
  educationPlace?: string;
  educationTime?: string;
  usefulness?: string;

  tripDestination?: string;
  tripCompanions?: string;
  tripPeriod?: string;
  tripExpenses?: { date: string; detail: string }[];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      userName,
      title,
      content,
      educationName,
      educationPeriod,
      educationPlace,
      educationTime,
      usefulness,
      tripDestination,
      tripCompanions,
      tripPeriod,
      tripExpenses,
    } = body;

    if (!id || !userName || !title) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    // 보고서 경로 찾기: reports/{userName}/userReports/{id}
    const docRef = db
      .collection("reports")
      .doc(userName)
      .collection("userReports")
      .doc(id);

    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 작성자 본인 확인
    if (doc.data()?.userName !== userName) {
      return NextResponse.json(
        { error: "수정 권한이 없습니다." },
        { status: 403 }
      );
    }

    // ✅ [수정] any 대신 UpdatePayload 타입 사용
    const updateData: UpdatePayload = {
      title,
      content,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // ✅ 값이 있는 경우에만 필드 추가 (undefined 체크)
    if (educationName !== undefined) updateData.educationName = educationName;
    if (educationPeriod !== undefined)
      updateData.educationPeriod = educationPeriod;
    if (educationPlace !== undefined)
      updateData.educationPlace = educationPlace;
    if (educationTime !== undefined) updateData.educationTime = educationTime;
    if (usefulness !== undefined) updateData.usefulness = usefulness;

    if (tripDestination !== undefined)
      updateData.tripDestination = tripDestination;
    if (tripCompanions !== undefined)
      updateData.tripCompanions = tripCompanions;
    if (tripPeriod !== undefined) updateData.tripPeriod = tripPeriod;
    if (tripExpenses !== undefined) updateData.tripExpenses = tripExpenses;

    await docRef.update({ ...updateData });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Report Update Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
