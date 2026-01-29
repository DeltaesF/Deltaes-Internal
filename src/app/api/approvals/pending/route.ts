import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

interface ApprovalDoc {
  id: string;
  userName: string;
  title: string;
  status: string;
  approvers: {
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };
  createdAt: number;
  // ✅ [추가 1] 날짜 표시를 위한 필드 추가
  implementDate?: string;
  // ✅ [추가 2] 프론트엔드 배지 표시 등을 위한 필드 추가
  approvalType?: string;
  workType?: string;
  docCategory?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { approverName } = await req.json();

    if (!approverName) {
      return NextResponse.json(
        { error: "사용자 이름이 누락되었습니다." },
        { status: 400 }
      );
    }

    const colRef = db.collectionGroup("userApprovals");

    // [A] 내가 '결재'해야 할 문서
    const queries = [
      colRef
        .where("status", "==", "1차 결재 대기")
        .where("approvers.first", "array-contains", approverName)
        .get(),
      colRef
        .where("status", "==", "2차 결재 대기")
        .where("approvers.second", "array-contains", approverName)
        .get(),
      colRef
        .where("status", "==", "3차 결재 대기")
        .where("approvers.third", "array-contains", approverName)
        .get(),
      // [B] 내가 '신청'한 대기 문서 (확인용)
      colRef
        .where("userName", "==", approverName)
        .where("status", "in", [
          "1차 결재 대기",
          "2차 결재 대기",
          "3차 결재 대기",
        ])
        .get(),
    ];

    const snapshots = await Promise.all(queries);
    const docsMap = new Map<string, ApprovalDoc>();

    snapshots.forEach((snap) => {
      snap.docs.forEach((doc) => {
        const data = doc.data();

        // createdAt 처리 (Map 형태 호환)
        let createdAtMillis = Date.now();
        if (data.createdAt) {
          if (typeof data.createdAt.toMillis === "function") {
            createdAtMillis = data.createdAt.toMillis();
          } else if (data.createdAt._seconds) {
            createdAtMillis = data.createdAt._seconds * 1000;
          } else if (typeof data.createdAt === "number") {
            createdAtMillis = data.createdAt;
          }
        }

        docsMap.set(doc.id, {
          id: doc.id,
          userName: data.userName,
          title: data.title,
          status: data.status,
          approvers: data.approvers,
          createdAt: createdAtMillis,

          // ✅ [핵심] implementDate 및 기타 필드 추가 (이게 없어서 날짜가 안 나왔던 것)
          implementDate: data.implementDate || null,
          approvalType: data.approvalType,
          workType: data.workType || null,
          docCategory: data.docCategory || "approval",
        });
      });
    });

    // 정렬 (최신순)
    const pending = Array.from(docsMap.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );

    return NextResponse.json({ pending });
  } catch (err) {
    console.error("❌ 품의서 대기 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
