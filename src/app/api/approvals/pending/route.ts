import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

type ApprovalDoc = {
  id: string;
  userName: string;
  status: string;
  approvers: {
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };
  createdAt?: Timestamp | number | SerializedTimestamp;
  title?: string;
  category?: string;
  docType?: string;
  [key: string]: unknown;
};

export async function POST(req: Request) {
  try {
    const { approverName } = await req.json();

    if (!approverName) {
      return NextResponse.json({ pending: [] });
    }

    const ref = db.collectionGroup("userApprovals");

    // ----------------------------------------------------------------
    // [1] 데이터 가져오기 (범위를 넓혀서 옛날 데이터도 포함)
    // ----------------------------------------------------------------
    const queries = [
      // 1. 1차 결재자: "1차 결재 대기"
      ref
        .where("approvers.first", "array-contains", approverName)
        .where("status", "==", "1차 결재 대기"),

      // 2. 2차 결재자: "2차 결재 대기" OR "1차 승인"(옛날 데이터 호환)
      ref
        .where("approvers.second", "array-contains", approverName)
        .where("status", "in", ["1차 결재 대기", "2차 결재 대기", "1차 승인"]),

      // 3. 3차 결재자: "3차 결재 대기" OR "2차 승인"(옛날 데이터 호환) 및 하위 단계
      ref
        .where("approvers.third", "array-contains", approverName)
        .where("status", "in", [
          "1차 결재 대기",
          "2차 결재 대기",
          "3차 결재 대기",
          "1차 승인", // 옛날 데이터 호환
          "2차 승인", // 옛날 데이터 호환
        ]),

      // 4. (옵션) 기안자 본인
      ref
        .where("userName", "==", approverName)
        .where("status", "in", [
          "1차 결재 대기",
          "2차 결재 대기",
          "3차 결재 대기",
        ]),
    ];

    const snapshots = await Promise.all(queries.map((q) => q.get()));

    // ----------------------------------------------------------------
    // [2] 데이터 병합 및 정교한 필터링
    // ----------------------------------------------------------------
    const docsMap = new Map<string, ApprovalDoc>();

    snapshots.forEach((snap) => {
      snap.docs.forEach((doc) => {
        if (docsMap.has(doc.id)) return;

        const data = doc.data() as ApprovalDoc;
        const status = data.status;
        const approvers = data.approvers || {
          first: [],
          second: [],
          third: [],
        };

        const isFirst = approvers.first?.includes(approverName);
        const isSecond = approvers.second?.includes(approverName);
        const isThird = approvers.third?.includes(approverName);
        const isDrafter = data.userName === approverName;

        const hasThirdApprover = approvers.third && approvers.third.length > 0;

        let shouldShow = false;

        // ✅ Case 1: 내 차례일 때 (Action Required)
        // -> "2차 결재 대기" 뿐만 아니라 "1차 승인" 상태도 내 차례로 인식하게 함

        if (isFirst && status === "1차 결재 대기") shouldShow = true;

        if (isSecond && (status === "2차 결재 대기" || status === "1차 승인")) {
          shouldShow = true;
        }

        if (isThird && (status === "3차 결재 대기" || status === "2차 승인")) {
          shouldShow = true;
        }

        // ✅ Case 2: 관망 모드 (Monitoring) - 하위 단계 보기
        // (A) 3차 결재자
        if (isThird) {
          if (
            status === "1차 결재 대기" ||
            status === "2차 결재 대기" ||
            status === "1차 승인"
          ) {
            shouldShow = true;
          }
        }

        // (B) 2차 결재자가 최종일 때
        if (isSecond && !hasThirdApprover && status === "1차 결재 대기") {
          shouldShow = true;
        }

        // (C) 기안자
        if (isDrafter) shouldShow = true;

        if (shouldShow) {
          let createdAtMillis = Date.now();

          if (data.createdAt) {
            if (typeof data.createdAt === "number") {
              createdAtMillis = data.createdAt;
            } else if (data.createdAt instanceof Timestamp) {
              createdAtMillis = data.createdAt.toMillis();
            } else if (
              typeof data.createdAt === "object" &&
              "_seconds" in data.createdAt
            ) {
              createdAtMillis =
                (data.createdAt as SerializedTimestamp)._seconds * 1000;
            }
          }

          docsMap.set(doc.id, {
            ...data,
            id: doc.id,
            createdAt: createdAtMillis,
            docType: "approval",
          });
        }
      });
    });

    const list = Array.from(docsMap.values());

    // 최신순 정렬
    list.sort((a, b) => (b.createdAt as number) - (a.createdAt as number));

    return NextResponse.json({ pending: list });
  } catch (error) {
    console.error("Error fetching approval pending list:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
