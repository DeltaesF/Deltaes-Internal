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
        docsMap.set(doc.id, {
          id: doc.id,
          userName: data.userName,
          title: data.title,
          status: data.status,
          approvers: data.approvers,
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : data.createdAt || Date.now(),
        });
      });
    });

    const pending = Array.from(docsMap.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );

    return NextResponse.json({ pending });
  } catch (err) {
    console.error("❌ 품의서 대기 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
