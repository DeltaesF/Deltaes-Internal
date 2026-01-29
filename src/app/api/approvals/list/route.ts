import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import {
  getFirestore,
  Timestamp,
  Query,
  DocumentData,
} from "firebase-admin/firestore";

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

// ✅ Timestamp 변환 헬퍼 (any 방지)
const toMillis = (val: unknown): number => {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && "toMillis" in val) {
    return (val as Timestamp).toMillis();
  }
  return Date.now();
};

export async function POST(req: Request) {
  try {
    const { page = 1, limit = 12, approvalType } = await req.json();

    // ----------------------------------------------------------------
    // [1] userApprovals 쿼리 (품의서/신청서)
    // ----------------------------------------------------------------
    let approvalsQuery: Query<DocumentData> =
      db.collectionGroup("userApprovals");

    if (approvalType) {
      if (Array.isArray(approvalType)) {
        approvalsQuery = approvalsQuery.where(
          "approvalType",
          "in",
          approvalType
        );
      } else {
        approvalsQuery = approvalsQuery.where(
          "approvalType",
          "==",
          approvalType
        );
      }
    }

    // ----------------------------------------------------------------
    // [2] userReports 쿼리 (출장 보고서 등)
    // ----------------------------------------------------------------
    let fetchReports = false;

    // approvalType 필터가 없거나(전체), 'business_trip'이 포함된 경우 보고서도 조회
    if (!approvalType) {
      fetchReports = true;
    } else if (
      Array.isArray(approvalType) &&
      approvalType.includes("business_trip")
    ) {
      fetchReports = true;
    } else if (approvalType === "business_trip") {
      fetchReports = true;
    }

    // ----------------------------------------------------------------
    // [3] 데이터 병렬 조회 (메모리 병합)
    // ----------------------------------------------------------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promises: Promise<any[]>[] = [];

    // (A) 품의서 가져오기
    promises.push(
      approvalsQuery.get().then((snap) =>
        snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: toMillis(data.createdAt),
            // implementDate가 있으면 가져오고 없으면 null
            implementDate: data.implementDate || null,
          };
        })
      )
    );

    // (B) 보고서 가져오기 (출장 보고서)
    if (fetchReports) {
      const reportsQuery = db
        .collectionGroup("userReports")
        .where("reportType", "==", "business_trip");

      promises.push(
        reportsQuery.get().then((snap) =>
          snap.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              // 프론트엔드 구분을 위해 approvalType 매핑
              approvalType: "business_trip",
              createdAt: toMillis(data.createdAt),
              // 보고서는 tripPeriod 등을 implementDate 처럼 쓸 수도 있음 (필요 시 로직 추가)
              implementDate: data.implementDate || null,
            };
          })
        )
      );
    }

    const results = await Promise.all(promises);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDocs: any[] = results.flat();

    // ----------------------------------------------------------------
    // [4] 정렬 (작성일 최신순) & 페이지네이션
    // ----------------------------------------------------------------

    // 내림차순 정렬 (최신이 위로)
    allDocs.sort((a, b) => b.createdAt - a.createdAt);

    const totalCount = allDocs.length;
    const offset = (page - 1) * limit;

    // 메모리 페이지네이션
    const list = allDocs.slice(offset, offset + limit);

    return NextResponse.json({ list, totalCount });
  } catch (error) {
    console.error("Error fetching approvals list:", error);
    const msg = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ list: [], totalCount: 0, error: msg });
  }
}
