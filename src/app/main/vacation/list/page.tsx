import { db } from "@/lib/firebaseAdmin";

async function getAllVacations() {
  try {
    // 모든 휴가 신청 내역을 최신순으로 가져옴
    const snapshot = await db
      .collectionGroup("requests")
      .orderBy("startDate", "desc")
      .limit(50) // 성능을 위해 최근 50개만 (필요시 조정)
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userName: data.userName || "이름 없음",
        types: data.types || "휴가",
        startDate: data.startDate,
        endDate: data.endDate,
        daysUsed: data.daysUsed,
        status: data.status,
        reason: data.reason,
      };
    });
  } catch (error) {
    console.error("Error fetching all vacations:", error);
    return [];
  }
}

export default async function VacationListPage() {
  const vacations = await getAllVacations();

  return (
    <div className="w-full p-6">
      <h2 className="text-2xl font-bold mb-6">📅 전체 휴가 현황</h2>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-4 text-sm font-semibold border-b">신청자</th>
              <th className="p-4 text-sm font-semibold border-b">종류</th>
              <th className="p-4 text-sm font-semibold border-b">기간</th>
              <th className="p-4 text-sm font-semibold border-b">사용일수</th>
              <th className="p-4 text-sm font-semibold border-b">사유</th>
              <th className="p-4 text-sm font-semibold border-b">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {vacations.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="p-4 text-sm font-medium">{v.userName}</td>
                <td className="p-4 text-sm">{v.types}</td>
                <td className="p-4 text-sm text-gray-600">
                  {v.startDate} ~ {v.endDate}
                </td>
                <td className="p-4 text-sm">{v.daysUsed}일</td>
                <td className="p-4 text-sm text-gray-500 truncate max-w-[200px]">
                  {v.reason}
                </td>
                <td className="p-4 text-sm">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      v.status === "최종 승인 완료"
                        ? "bg-green-100 text-green-700"
                        : v.status === "반려"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {v.status}
                  </span>
                </td>
              </tr>
            ))}
            {vacations.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">
                  등록된 휴가 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
