import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type ApprovalHistoryEntry = {
  approver: string;
  status: string;
  approvedAt: Date | FirebaseFirestore.Timestamp;
};

type VacationDoc = {
  approvers: { first?: string[]; second?: string[] };
  status: string;
  userName: string;
  approvalStep?: number;
  approvalHistory?: ApprovalHistoryEntry[];
  daysUsed: number; // 👈 휴가 사용 일수 (필수)
};

export async function POST(req: Request) {
  try {
    const { vacationId, approverName, applicantUserName } = await req.json();

    if (!vacationId || !approverName || !applicantUserName) {
      return NextResponse.json(
        { error: "필수 정보가 누락되었습니다." },
        { status: 400 }
      );
    }

    const vacationRef = db
      .collection("vacation")
      .doc(applicantUserName)
      .collection("requests")
      .doc(vacationId);

    // 🔽 [변경] runTransaction을 사용하여 데이터 무결성 보장
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(vacationRef);

      if (!doc.exists) {
        throw new Error("해당 휴가 신청을 찾을 수 없습니다.");
      }

      const vacationData = doc.data() as VacationDoc;
      const { approvers, status, daysUsed } = vacationData; // daysUsed 가져오기
      let newStatus = status;
      let approvalStep = vacationData.approvalStep || 0;
      let newHistoryStatus = "";

      // 1차 결재자가 존재하는지, 2차 결재자가 존재하는지 체크
      const hasFirstApprovers = approvers.first && approvers.first.length > 0;
      const hasSecondApprovers =
        approvers.second && approvers.second.length > 0;

      // ✅ 1차 결재자 승인
      if (approvers.first?.includes(approverName)) {
        if (status !== "대기") throw new Error("이미 처리된 요청입니다.");

        // (기존 로직: 1차 결재자들 모두 승인했는지 확인)
        const firstApproversInHistory = (vacationData.approvalHistory || [])
          .filter((entry) => approvers.first?.includes(entry.approver))
          .map((entry) => entry.approver);
        const allApprovedFirst = [
          ...new Set([...firstApproversInHistory, approverName]),
        ];
        const allFirstHaveApproved = approvers.first!.every((name) =>
          allApprovedFirst.includes(name)
        );

        if (allFirstHaveApproved) {
          // 🔽 [수정] 2차 결재자가 없으면 바로 최종 승인, 있으면 1차 완료
          if (!hasSecondApprovers) {
            newStatus = "최종 승인 완료";
            newHistoryStatus = "최종 승인 완료 (1차 전결)";
            approvalStep = 2;
          } else {
            newStatus = "1차 결재 완료";
            newHistoryStatus = "1차 결재 완료";
            approvalStep = 1;
          }
        } else {
          newStatus = "대기";
          newHistoryStatus = "1차 승인 (진행중)";
          approvalStep = 0;
        }
      }
      // ✅ 2차 결재자 승인 (최종 승인)
      else if (approvers.second?.includes(approverName)) {
        // 2-A: 정상적인 흐름 (1차 결재 완료 -> 2차 승인)
        if (status === "1차 결재 완료") {
          newStatus = "최종 승인 완료";
          newHistoryStatus = "최종 승인 완료";
          approvalStep = 2;
        }
        // 🔽 2-B: [신규 기능] 1차 결재자가 아예 없는 경우 (대기 -> 바로 최종 승인)
        else if (status === "대기" && !hasFirstApprovers) {
          newStatus = "최종 승인 완료";
          newHistoryStatus = "최종 승인 완료 (즉시 승인)";
          approvalStep = 2;
        } else {
          throw new Error(
            "아직 1차 결재가 완료되지 않았거나 이미 처리된 요청입니다."
          );
        }
      }
      // 권한 없음
      else {
        throw new Error("승인 권한이 없습니다.");
      }

      // [승인 기록 생성]
      const approvalTime = new Date();
      const newHistoryEntry = {
        approver: approverName,
        status: newHistoryStatus,
        approvedAt: approvalTime,
      };

      // [문서 업데이트]
      transaction.update(vacationRef, {
        status: newStatus,
        approvalStep,
        lastApprovedAt: approvalTime,
        approvalHistory: FieldValue.arrayUnion(newHistoryEntry),
      });

      // 🔽 [추가] 최종 승인 시, employee 컬렉션의 휴가 일수 자동 차감
      if (newStatus === "최종 승인 완료") {
        // employee 문서 ID가 applicantUserName(예: "홍성원 프로")과 같다고 가정
        const employeeRef = db.collection("employee").doc(applicantUserName);

        transaction.update(employeeRef, {
          usedVacation: FieldValue.increment(daysUsed), // 사용일수 증가 (+)
          remainingVacation: FieldValue.increment(-daysUsed), // 잔여일수 감소 (-)
        });
      }
    });

    return NextResponse.json({
      message: "결재 승인 및 휴가 일수 반영 완료",
    });
  } catch (err) {
    console.error("승인 오류:", err);
    const message = err instanceof Error ? err.message : "서버 오류 발생";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
