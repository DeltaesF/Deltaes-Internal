"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import koLocale from "@fullcalendar/core/locales/ko";
import { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}
interface VacationEvent {
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
}

interface VacationResponse {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  types: string;
  status: string;
  daysUsed: number;
  reason?: string;
  approvalHistory?: {
    approver: string;
    status: string;
    approvedAt: string | FirestoreTimestamp;
  }[];
}

// -----------------------------------------------------------------------
// [1] Fetcher 함수들
// -----------------------------------------------------------------------

// 1. 내 휴가 목록 조회 (전체 이력)
const fetchMyVacations = async (userDocId: string) => {
  const res = await fetch(`/api/vacation/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "user", userName: userDocId }),
  });
  const data = await res.json();
  return ((data.list as VacationResponse[]) || []).sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
};

// 2. 내 연차 정보 (잔여/사용) 조회
const fetchUserStats = async (userDocId: string) => {
  const res = await fetch(`/api/vacation/user?userDocId=${userDocId}`);
  return res.json();
};

// 3. 전체 휴가 일정 (캘린더용)
const fetchAllVacations = async () => {
  const res = await fetch("/api/vacation/list");
  const data = await res.json();
  const requests: VacationResponse[] = data.requests || [];

  return requests
    .filter((v) => v.status === "최종 승인 완료")
    .map((v) => {
      const endPlusOne = new Date(v.endDate);
      endPlusOne.setDate(endPlusOne.getDate() + 1);

      return {
        title: `${v.userName} (${v.types})`,
        start: v.startDate,
        end: endPlusOne.toISOString().split("T")[0],
        backgroundColor: "#519d9e",
        textColor: "#ffffff",
        borderColor: "transparent",
      } as VacationEvent;
    });
};

// -----------------------------------------------------------------------
// [2] 컴포넌트 시작
// -----------------------------------------------------------------------

export default function UserV() {
  const { userDocId } = useSelector((state: RootState) => state.auth);

  // 모달 상태 (이력 요약 보기용)
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // =====================================================================
  // Data Fetching
  // =====================================================================

  const { data: myVacations = [] } = useQuery({
    queryKey: ["vacations", "my", userDocId],
    queryFn: () => fetchMyVacations(userDocId!),
    enabled: !!userDocId,
  });

  const { data: userStats = { remainingVacation: 0, usedVacation: 0 } } =
    useQuery({
      queryKey: ["vacations", "stats", userDocId],
      queryFn: () => fetchUserStats(userDocId!),
      enabled: !!userDocId,
    });

  const { data: events = [] } = useQuery({
    queryKey: ["vacations", "calendar"],
    queryFn: fetchAllVacations,
  });

  return (
    <div className="flex flex-col gap-4 w-full px-4 md:px-0">
      {/* 🔹 상단 헤더 & 버튼 */}
      <div className="flex justify-between items-center mt-2">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 hidden md:block">
          휴가 관리
        </h2>
        <Link
          href="/main/vacation/write"
          prefetch={false}
          className="ml-auto px-4 py-2 md:px-5 md:py-2.5 rounded-xl bg-[#519d9e] text-white hover:bg-[#407f80] transition-colors text-xs md:text-sm font-bold shadow-md whitespace-nowrap"
        >
          + 휴가 신청하기
        </Link>
      </div>

      {/* 🔹 통계 카드 - 모바일 grid-cols-1, 태블릿 이상 grid-cols-2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full max-w-[1200px] mx-auto">
        {/* 잔여 연차 */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center gap-2 group">
          <span className="text-gray-500 text-sm md:text-base font-medium">
            잔여 휴가
          </span>
          <p className="text-4xl md:text-5xl font-extrabold text-[#519d9e]">
            {userStats.remainingVacation ?? 0}{" "}
            <span className="text-base md:text-lg font-normal text-gray-400">
              일
            </span>
          </p>
        </div>

        {/* 사용 연차 */}
        <div
          className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center gap-2 cursor-pointer group hover:bg-gray-50 hover:border-gray-300 transition-all"
          onClick={() => setShowHistoryModal(true)}
        >
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm md:text-base font-medium">
              총 사용 휴가
            </span>
            <span className="bg-gray-100 text-gray-500 text-[10px] md:text-xs px-2 py-0.5 rounded-full group-hover:bg-white transition-colors">
              내역 보기 &gt;
            </span>
          </div>
          <p className="text-4xl md:text-5xl font-extrabold text-gray-700">
            {userStats.usedVacation ?? 0}{" "}
            <span className="text-base md:text-lg font-normal text-gray-400">
              일
            </span>
          </p>
        </div>
      </div>

      {/* 🔹 캘린더 영역 - 모바일 패딩 축소 및 높이 조절 */}
      <div className="bg-white shadow-md border rounded-2xl p-4 md:p-6 w-full max-w-[1200px] mx-auto mb-10">
        <h3 className="text-base md:text-lg font-bold mb-4 text-gray-700">
          📅 휴가 일정 캘린더
        </h3>
        <div className="h-[500px] md:h-[600px]">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="100%"
            locale={koLocale}
            events={events}
            dayMaxEvents={2}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek",
            }}
          />
        </div>
      </div>

      {/* ==================== 모달 영역 ==================== */}

      {/* 휴가 신청 이력 요약 모달 */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 md:p-6 w-full max-w-[500px] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg md:text-xl font-bold text-gray-800">
                최근 휴가 신청 내역
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-black text-2xl cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="mb-4 overflow-y-auto flex-1 max-h-[60vh] md:max-h-[400px]">
              {myVacations.length > 0 ? (
                <ul className="divide-y border rounded-lg">
                  {myVacations.map((v) => (
                    <li
                      key={v.id}
                      className="py-3 px-3 md:px-4 bg-white flex justify-between items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              v.status === "최종 승인 완료"
                                ? "bg-green-100 text-green-700"
                                : v.status.includes("반려")
                                ? "bg-red-100 text-red-600"
                                : "bg-blue-100 text-blue-600"
                            }`}
                          >
                            {v.status}
                          </span>
                          <span className="font-semibold text-gray-700 text-xs md:text-sm truncate">
                            {v.types}
                          </span>
                        </div>
                        <p className="text-[11px] md:text-xs text-gray-500">
                          {v.startDate} ~ {v.endDate}
                        </p>
                      </div>
                      <span className="text-xs md:text-sm font-bold text-gray-800 ml-2">
                        {v.daysUsed}일
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-gray-400 py-6 bg-gray-50 rounded-lg text-sm">
                  신청한 휴가 내역이 없습니다.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="flex-1 bg-gray-200 py-2 md:py-2.5 rounded-lg hover:bg-gray-300 font-medium text-gray-600 text-xs md:text-sm transition-colors cursor-pointer"
              >
                닫기
              </button>
              <Link
                href="/main/vacation/list"
                prefetch={false}
                className="flex-1 bg-[#519d9e] flex items-center justify-center py-2 md:py-2.5 rounded-lg hover:bg-[#407f80] font-medium text-white text-xs md:text-sm transition-colors text-center"
              >
                전체 내역 보기 →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
