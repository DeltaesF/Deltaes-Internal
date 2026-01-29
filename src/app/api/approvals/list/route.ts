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
    const body = await req.json();
    const { page = 1, limit = 12, approvalType } = body;

    let query: Query = db.collectionGroup("userApprovals");

    // 1. 필터링 (Where)
    if (approvalType) {
      if (Array.isArray(approvalType) && approvalType.length > 0) {
        query = query.where("approvalType", "in", approvalType);
      } else if (typeof approvalType === "string") {
        query = query.where("approvalType", "==", approvalType);
      }
    }

    // 2. 정렬 (OrderBy) - 작성일 최신순
    // 주의: Firestore 콘솔에서 'approvalType'과 'createdAt'에 대한 복합 인덱스(Composite Index)가 생성되어 있어야 정확히 동작합니다.
    query = query.orderBy("createdAt", "desc");

    // 3. 총 개수 계산
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    // 4. 페이지네이션
    const offset = (page - 1) * limit;
    const snapshot = await query.limit(limit).offset(offset).get();

    const list = snapshot.docs.map((doc) => {
      const d = doc.data();

      // ✅ [수정] createdAt 파싱 로직 개선
      // Date.now()를 제거하여, 날짜 데이터가 꼬인 문서가 최상단에 오는 것을 방지
      let createdAtMillis = 0;

      if (d.createdAt) {
        if (typeof d.createdAt.toMillis === "function") {
          // 1. Firestore Timestamp 객체인 경우
          createdAtMillis = d.createdAt.toMillis();
        } else if (d.createdAt._seconds) {
          // 2. JSON 직렬화된 Timestamp 객체인 경우 (map 형태)
          createdAtMillis = d.createdAt._seconds * 1000;
        } else if (typeof d.createdAt === "number") {
          // 3. 숫자인 경우
          createdAtMillis = d.createdAt;
        } else if (typeof d.createdAt === "string") {
          // 4. 문자열인 경우
          const parsed = new Date(d.createdAt).getTime();
          createdAtMillis = isNaN(parsed) ? 0 : parsed;
        }
      }
      // 값이 없으면 0으로 두어 리스트 맨 끝으로 보냄

      return {
        id: doc.id,
        title: d.title,
        userName: d.userName,
        department: d.department,
        status: d.status,
        approvalType: d.approvalType,
        workType: d.workType || null,
        docCategory: d.docCategory || null,

        implementDate: d.implementDate || null,

        // 수정된 값 적용
        createdAt: createdAtMillis,

        serialNumber: d.serialNumber || "-",
        customerName: d.customerName || "-",
        product: d.product || "-",
      };
    });

    return NextResponse.json({ list, totalCount });
  } catch (error) {
    console.error("Error fetching approval list:", error);
    return NextResponse.json({ list: [], totalCount: 0 });
  }
}
