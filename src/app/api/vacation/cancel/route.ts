import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { vacationId, applicantUserName } = await req.json();

    if (!vacationId || !applicantUserName) {
      return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
    }

    const docRef = db
      .collection("vacation")
      .doc(applicantUserName)
      .collection("requests")
      .doc(vacationId);

    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const data = doc.data();
    const status = data?.status || "";
    const approvers = data?.approvers || {}; // 결재자 정보 가져오기

    // 취소 가능 상태 확인
    const cancellableStatuses = [
      "1차 결재 대기",
      "2차 결재 대기",
      "3차 결재 대기",
      "1차 결재 완료",
      "2차 결재 완료",
      "대기",
    ];
    if (!cancellableStatuses.includes(status)) {
      return NextResponse.json(
        { error: `현재 '${status}' 상태이므로 취소할 수 없습니다.` },
        { status: 400 }
      );
    }

    // ✅ [추가] 알림 삭제 로직
    // 1차, 2차 결재자 모두에게 간 알림 중 vacationId가 일치하는 것을 지움
    const batch = db.batch();

    // 알림을 확인해야 할 대상 목록 (1차 + 2차 결재자)
    const targetApprovers = [
      ...(approvers.first || []),
      ...(approvers.second || []),
      ...(approvers.third || []),
    ];

    for (const approverName of targetApprovers) {
      // 해당 결재자의 알림함에서 vacationId가 일치하는 알림 검색
      const notiSnapshot = await db
        .collection("notifications")
        .doc(approverName)
        .collection("userNotifications")
        .where("vacationId", "==", vacationId) // 아까 저장한 ID로 검색
        .get();

      notiSnapshot.forEach((notiDoc) => {
        batch.delete(notiDoc.ref); // 찾으면 삭제 리스트에 추가
      });
    }

    // 문서 삭제
    batch.delete(docRef);

    // 일괄 실행 (알림 삭제 + 휴가 문서 삭제)
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "취소 실패" }, { status: 500 });
  }
}
