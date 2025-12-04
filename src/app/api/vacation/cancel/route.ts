import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const { vacationId, applicantUserName } = await req.json();

    if (!vacationId || !applicantUserName) {
      return NextResponse.json(
        { error: "필수 정보(vacationId, applicantUserName)가 누락되었습니다." },
        { status: 400 }
      );
    }

    const vacationRef = db
      .collection("vacation")
      .doc(applicantUserName)
      .collection("requests")
      .doc(vacationId);

    // 🔽 [변경] runTransaction을 사용하여 데이터 복구 및 삭제를 원자적으로 처리
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(vacationRef);

      if (!doc.exists) {
        throw new Error("삭제할 휴가 신청을 찾을 수 없습니다.");
      }

      const vacationData = doc.data();
      const status = vacationData?.status;
      const daysUsed = vacationData?.daysUsed || 0;

      // 🔽 [수정] 취소 가능 상태 확인
      // '대기' 또는 '최종 승인 완료' 상태일 때만 취소/삭제 가능하도록 허용
      // (1차 결재 완료 상태에서 취소 시에도 삭제 가능)
      if (
        status !== "대기" &&
        status !== "최종 승인 완료" &&
        status !== "1차 결재 완료"
      ) {
        // 이미 반려되었거나 다른 상태라면 에러 처리
        throw new Error(`'${status}' 상태인 요청은 취소할 수 없습니다.`);
      }

      // 🔽 [추가] 이미 '최종 승인 완료'되어 차감된 건이라면 -> 휴가 일수 원상복구(환불)
      if (status === "최종 승인 완료") {
        const employeeRef = db.collection("employee").doc(applicantUserName);

        transaction.update(employeeRef, {
          usedVacation: FieldValue.increment(-daysUsed), // 사용일수 감소 (복구)
          remainingVacation: FieldValue.increment(daysUsed), // 잔여일수 증가 (복구)
        });
      }

      // [문서 삭제]
      transaction.delete(vacationRef);
    });

    return NextResponse.json({
      message: "휴가 요청이 성공적으로 취소되었습니다.",
    });
  } catch (err) {
    console.error("휴가 취소 오류:", err);
    const message = err instanceof Error ? err.message : "서버 오류 발생";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
