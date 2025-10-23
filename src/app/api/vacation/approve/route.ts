import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { vacationId, approverName } = await req.json();

    const vacationRef = db.collection("vacation").doc(vacationId);
    const vacationDoc = await vacationRef.get();

    if (!vacationDoc.exists) {
      return NextResponse.json(
        { error: "해당 휴가 신청이 없습니다." },
        { status: 404 }
      );
    }

    const vacationData = vacationDoc.data();
    if (!vacationData) {
      return NextResponse.json(
        { error: "휴가 데이터가 없습니다." },
        { status: 404 }
      );
    }

    const { approvers, status } = vacationData;
    let newStatus = status;
    let approvalStep = vacationData.approvalStep || 0;

    // ✅ 1차 결재자 승인
    if (status === "1차 결재 대기" && approvers.first?.includes(approverName)) {
      newStatus = "2차 결재 대기";
      approvalStep = 1;

      // 🔔 2차 결재자에게 결재 요청 생성
      for (const second of approvers.second || []) {
        await db.collection("approvalNotifications").add({
          vacationId,
          receiver: second,
          step: "2차 결재",
          message: `${vacationData.userName}님의 휴가 결재 요청이 도착했습니다.`,
          createdAt: new Date(),
        });
      }
    }

    // ✅ 2차 결재자 승인 (최종 승인)
    else if (
      status === "2차 결재 대기" &&
      approvers.second?.includes(approverName)
    ) {
      newStatus = "최종 승인";
      approvalStep = 2;
    }

    // 권한 없음
    else {
      return NextResponse.json(
        { error: "승인 권한이 없습니다." },
        { status: 403 }
      );
    }

    await vacationRef.update({
      status: newStatus,
      approvalStep,
      approvedAt: new Date(),
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
