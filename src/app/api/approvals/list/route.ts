import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Query } from "firebase-admin/firestore";

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
    const { page = 1, limit = 12, approvalType } = await req.json();

    let query: Query = db.collectionGroup("userApprovals");

    // 1. 카테고리 필터링
    if (approvalType) {
      if (Array.isArray(approvalType)) {
        // 배열인 경우 (통합 리스트 등)
        query = query.where("approvalType", "in", approvalType);
      } else {
        // 단일 문자열인 경우
        query = query.where("approvalType", "==", approvalType);
      }
    }

    // 2. ✅ [핵심] 최신순 정렬 추가
    // 주의: Firestore에서 where('in')과 orderBy를 같이 쓰려면 복합 색인(Index)이 필요할 수 있습니다.
    // 에러 발생 시 콘솔에 뜨는 링크를 클릭하여 색인을 생성해주세요.
    query = query.orderBy("createdAt", "desc");

    // 3. 전체 개수 조회
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    // 4. 페이지네이션
    const offset = (page - 1) * limit;
    const snapshot = await query.limit(limit).offset(offset).get();

    const list = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Timestamp -> Number 변환 안전 처리
        createdAt:
          data.createdAt && typeof data.createdAt.toMillis === "function"
            ? data.createdAt.toMillis()
            : data.createdAt || Date.now(),
      };
    });

    return NextResponse.json({ list, totalCount });
  } catch (error) {
    console.error("Error fetching approvals list:", error);
    // any 타입 에러 방지
    const msg = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ list: [], totalCount: 0, error: msg });
  }
}
