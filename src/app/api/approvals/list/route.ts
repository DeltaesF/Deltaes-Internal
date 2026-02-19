import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import {
  getFirestore,
  Timestamp,
  Query,
  DocumentData,
} from "firebase-admin/firestore";

// ✅ 인터페이스 정의: any를 대체하기 위해 공통 필드를 정의합니다.
interface ApprovalBaseData {
  id: string;
  userName: string; // 👈 필수 필드로 지정
  title: string;
  status: string;
  createdAt: number;
  approvalType: string;
  implementDate?: string | null;
  [key: string]: unknown; // 기타 동적 필드 허용
}

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
    const {
      page = 1,
      limit = 12,
      approvalType,
      userName,
      role,
    } = await req.json();

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
    const promises: Promise<ApprovalBaseData[]>[] = [];

    // (A) 품의서 가져오기
    promises.push(
      approvalsQuery.get().then((snap) =>
        snap.docs
          .map((doc) => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              userName: data.userName || "", // 확실하게 매핑
              createdAt: toMillis(data.createdAt),
              implementDate: data.implementDate || null,
            } as ApprovalBaseData; // ✅ 타입 단언 (Assertion)
          })
          // ✅ [권한 필터링 추가]
          // admin이나 supervisor가 아니면, 작성자(userName)가 본인인 것만 남김
          .filter((item) => {
            if (role === "admin" || role === "supervisor") return true;
            return item.userName === userName;
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
          snap.docs
            .map((doc) => {
              const data = doc.data();
              return {
                ...data,
                id: doc.id,
                userName: data.userName || "", // 확실하게 매핑
                approvalType: "business_trip",
                createdAt: toMillis(data.createdAt),
                implementDate: data.implementDate || null,
              } as ApprovalBaseData;
            })
            // ✅ [권한 필터링 추가]
            // admin이나 supervisor가 아니면, 작성자(userName)가 본인인 것만 남김
            .filter((item) => {
              if (role === "admin" || role === "supervisor") return true;
              return item.userName === userName;
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
