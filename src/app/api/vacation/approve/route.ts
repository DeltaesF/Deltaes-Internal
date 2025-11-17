// /api/vacation/approve/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type ApprovalHistoryEntry = {
  approver: string;
  status: string;
  approvedAt: Date | FirebaseFirestore.Timestamp;
};

// [1] 휴가 문서의 타입을 정의하여 'data possibly undefined' 오류를 해결합니다.
type VacationDoc = {
  approvers: { first?: string[]; second?: string[] };
  status: string;
  userName: string;
  approvalStep?: number;
  approvalHistory?: ApprovalHistoryEntry[];
};

export async function POST(req: Request) {
  try {
    const { vacationId, approverName, applicantUserName } = await req.json();

    // ✅ vacation/{userDocId}/requests 하위 컬렉션 전체 검색
    if (!vacationId || !approverName || !applicantUserName) {
      return NextResponse.json(
        {
          error:
            "필수 인자(vacationId, approverName, applicantUserName)가 누락되었습니다.",
        },
        { status: 400 }
      );
    }

    // 🔽 [2] collectionGroup 쿼리 대신, 문서의 '직접 경로'를 지정합니다.
    const vacationRef = db
      .collection("vacation")
      .doc(applicantUserName) // 예: "홍성원 프로"
      .collection("requests")
      .doc(vacationId); // 예: "zZaTC0oF7g611NC3Sfbe"

    // 🔽 [3] 해당 문서를 직접 .get() 합니다.
    const doc = await vacationRef.get();

    if (!doc.exists) {
      // 👈 .empty 대신 .exists로 체크
      return NextResponse.json(
        { error: "해당 휴가 신청을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // const doc = snapshot.docs[0];
    // const vacationRef = doc.ref;
    const vacationData = doc.data() as VacationDoc;

    const { approvers, status } = vacationData;
    let newStatus = status;
    let approvalStep = vacationData.approvalStep || 0;

    // 🔽 [1] 새 히스토리 항목의 상태를 미리 정의
    let newHistoryStatus = "";

    // ✅ 1차 결재자 승인
    if (status === "대기" && approvers.first?.includes(approverName)) {
      // 🔽 [2] 현재까지 1차 승인한 사람들 목록 (방금 승인한 사람 포함)
      const firstApproversInHistory = (vacationData.approvalHistory || [])
        // 1차 결재자 목록에 있으면서 '대기' 상태일 때 승인한 기록만 필터링
        .filter(
          (entry) =>
            approvers.first?.includes(entry.approver) &&
            (entry.status === "1차 승인 (진행중)" ||
              entry.status === "1차 결재 완료")
        )
        .map((entry) => entry.approver);

      const allApprovedFirst = [
        ...new Set([...firstApproversInHistory, approverName]),
      ];

      // 🔽 [3] 필수 1차 결재자 목록
      const requiredFirst = approvers.first || [];

      // 🔽 [4] 필수 1차 결재자 모두가 승인했는지 확인
      const allFirstHaveApproved = requiredFirst.every((name) =>
        allApprovedFirst.includes(name)
      );

      if (allFirstHaveApproved) {
        // [5-A] 모두 승인함 -> 1차 결재 완료
        newStatus = "1차 결재 완료";
        newHistoryStatus = "1차 결재 완료"; // 히스토리에도 기록
        approvalStep = 1;
      } else {
        // [5-B] 아직 모두 승인 안 함 -> '대기' 상태 유지
        newStatus = "대기";
        newHistoryStatus = "1차 승인 (진행중)"; // 히스토리에만 기록
        approvalStep = 0;
      }
    }

    // ✅ 2차 결재자 승인 (최종 승인)
    else if (
      status === "1차 결재 완료" &&
      approvers.second?.includes(approverName)
    ) {
      newStatus = "최종 승인 완료";
      newHistoryStatus = "최종 승인 완료";
      approvalStep = 2;
    }

    // 권한 없음
    else {
      return NextResponse.json(
        { error: "승인 권한이 없거나 이미 처리된 요청입니다." },
        { status: 403 }
      );
    }

    // [6] 승인 기록 객체 생성
    const approvalTime = new Date();
    const newHistoryEntry = {
      approver: approverName,
      status: newHistoryStatus, // 🔽 newStatus 대신 newHistoryStatus 사용
      approvedAt: approvalTime,
    };

    // [7] 상태 업데이트
    await vacationRef.update({
      status: newStatus, // 👈 '대기' 또는 '1차 결재 완료'
      approvalStep,
      lastApprovedAt: approvalTime,
      approvalHistory: FieldValue.arrayUnion(newHistoryEntry),
    });

    return NextResponse.json({
      message: "결재 승인 완료",
      status: newStatus,
    });
  } catch (err) {
    console.error("승인 오류:", err);
    return NextResponse.json({ error: "서버 오류 발생" }, { status: 500 });
  }
}
