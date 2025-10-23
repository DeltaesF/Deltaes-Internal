import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

interface VacationRequest {
  startDate: string;
  endDate: string;
  types: string;
  daysUsed: number;
  reason: string;
  status: string;
  createdAt: string;
  userName: string;
  userId: string;
}

export async function POST(req: Request) {
  try {
    const { role, userName } = await req.json(); // 클라이언트에서 보내줌
    const vacationRef = db.collection("vacations");
    let query;

    // ✅ role에 따라 다른 쿼리
    if (role === "user") {
      // 내가 작성한 문서 중 '대기' 상태
      query = vacationRef
        .where("userName", "==", userName)
        .where("status", "==", "대기");
    } else if (role === "admin") {
      // 1차 결재자 리스트 중 나 포함 && '대기'
      query = vacationRef
        .where("approvers.first", "array-contains", userName)
        .where("status", "==", "대기");
    } else if (role === "ceo") {
      // 2차 결재자 리스트 중 나 포함 && '1차 승인 완료'
      query = vacationRef
        .where("approvers.second", "array-contains", userName)
        .where("status", "==", "1차 승인 완료");
    } else {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const snapshot = await query.get();

    const pendingList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(pendingList);
  } catch (err) {
    console.error("대기 문서 조회 오류:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const employeesSnap = await db.collection("employee").get();
    const allRequests: VacationRequest[] = [];

    for (const emp of employeesSnap.docs) {
      const empData = emp.data();
      const reqSnap = await db
        .collection("vacation")
        .doc(emp.id)
        .collection("requests")
        .get();

      reqSnap.forEach((r) => {
        const data = r.data();
        allRequests.push({
          startDate: data.startDate,
          endDate: data.endDate,
          types: data.types,
          daysUsed: data.daysUsed,
          reason: data.reason,
          status: data.status,
          createdAt: data.createdAt,
          userName: empData.userName,
          userId: emp.id,
        });
      });
    }

    return NextResponse.json({ requests: allRequests });
  } catch (error) {
    console.error("❌ Error fetching vacation data:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
