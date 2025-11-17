"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { useEffect, useState } from "react";
import VacationWrite from "../write/page";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

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
}

export default function UserV() {
  const [activeTab, setActiveTab] = useState<"vacation" | "vacationWrite">(
    "vacation"
  );

  // ✅ Redux 로그인 정보 가져오기
  const { userDocId, userName } = useSelector((state: RootState) => state.auth);

  // ✅ 개인 요약 데이터
  const [remaining, setRemaining] = useState<number>(0);
  const [used, setUsed] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [showModal, setShowModal] = useState(false);
  const [myVacations, setMyVacations] = useState<VacationResponse[]>([]);

  // ✅ 전체 휴가 데이터 (캘린더용)
  const [events, setEvents] = useState<VacationEvent[]>([]);

  // 휴가 결재 리스트
  const fetchMyVacations = async () => {
    if (!userDocId) return;
    try {
      const res = await fetch(`/api/vacation/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", userName: userDocId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMyVacations(data.list || []); // 👈 data.list 사용
      }
    } catch (err) {
      console.error("내 휴가 내역 조회 실패:", err);
    }
  };

  useEffect(() => {
    if (!userDocId) return;
    fetchMyVacations();
  }, [userDocId]);

  const fetchUserData = async () => {
    try {
      // employee/{userDocId}
      const empRes = await fetch(`/api/vacation/user?userDocId=${userDocId}`);
      const empData = await empRes.json();
      if (empRes.ok) {
        setRemaining(empData.remainingVacation ?? 0);
        setUsed(empData.usedVacation ?? 0);
      }

      // 2️⃣ vacation/{userDocId}/requests 중 status: 대기
      const reqRes = await fetch(
        `/api/vacation/pending?userDocId=${userDocId}`
      );
      const reqData = await reqRes.json();
      if (reqRes.ok) {
        setPendingCount(reqData.pendingCount ?? 0);
      }
    } catch (err) {
      console.error("❌ 개인 데이터 조회 실패:", err);
    }
  };

  useEffect(() => {
    if (!userDocId) return;
    fetchUserData();
  }, [userDocId]);

  // ✅ 전체 임직원 휴가 일정 가져오기
  useEffect(() => {
    const fetchAllVacations = async () => {
      try {
        const res = await fetch("/api/vacation/list");
        const data = await res.json();

        if (!res.ok) throw new Error("API 요청 실패");

        // ✅ 승인된 항목만 필터링
        const approvedVacations: VacationResponse[] = data.requests.filter(
          (v: VacationResponse) => v.status === "최종 승인 완료"
        );

        // ✅ FullCalendar에 맞게 endDate 하루 추가
        const mapped: VacationEvent[] = approvedVacations.map((v) => {
          const endPlusOne = new Date(v.endDate);
          endPlusOne.setDate(endPlusOne.getDate() + 1);

          return {
            title: `${v.userName} (${v.types})`,
            start: v.startDate,
            end: endPlusOne.toISOString().split("T")[0], // 하루 더한 날짜
            backgroundColor: "#4caf50",
          };
        });

        setEvents(mapped);
      } catch (err) {
        console.error("❌ 전체 휴가 조회 실패:", err);
      }
    };

    fetchAllVacations();
  }, []);

  // 🔽 [신규] 휴가 취소 핸들러 함수
  const handleCancelVacation = async (vacationId: string) => {
    if (!window.confirm("이 휴가 요청을 정말로 취소하시겠습니까?")) {
      return;
    }

    try {
      const res = await fetch("/api/vacation/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacationId: vacationId,
          applicantUserName: userDocId, // 내 userDocId 전송
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "휴가 취소에 실패했습니다.");
      }

      alert("휴가 요청이 취소되었습니다.");
      // 목록과 카드 카운트를 새로고침
      fetchMyVacations();
      fetchUserData();
    } catch (err) {
      console.error("휴가 취소 오류:", err);
      alert(
        err instanceof Error ? err.message : "취소 중 오류가 발생했습니다."
      );
    }
  };

  if (activeTab === "vacationWrite") {
    return <VacationWrite onCancel={() => setActiveTab("vacation")} />;
  }

  return (
    <div className="flex flex-col gap-12 w-full">
      <div className="flex items-center relative">
        <div className="ml-auto relative">
          <button
            className="px-4 py-2 rounded-xl border border-[#519d9e] hover:bg-[#519d9e] hover:text-white cursor-pointer"
            onClick={() => {
              setActiveTab("vacationWrite");
            }}
          >
            휴가원 작성 ▾
          </button>
        </div>
      </div>

      {/* 개인 휴가 현황 */}
      <div className="flex justify-center gap-10">
        <div className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center">
          <span className="text-gray-600 font-medium">미사용 휴가 일수</span>
          <p className="text-4xl font-bold">{remaining} 개</p>
        </div>
        <div className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center">
          <span className="text-gray-600 font-medium">사용 휴가 일수</span>
          <p className="text-4xl font-bold">{used} 개</p>
        </div>
        <div
          className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center cursor-pointer"
          onClick={() => setShowModal(true)}
        >
          <span className="text-gray-600 font-medium">휴가 결재 요청</span>
          <p className="text-4xl font-bold">{pendingCount} 건</p>
        </div>
      </div>

      {/* 🔹 휴가 결재 요청 모달 (일반 유저) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl p-6 w-[600px]">
            <h3 className="text-lg font-bold mb-4">휴가 결재 요청 내역</h3>
            <ul className="divide-y">
              {myVacations.length > 0 ? (
                myVacations.map((v) => (
                  <li key={v.startDate + v.userName} className="py-3 px-2">
                    <p className="font-semibold">{v.userName}</p>
                    <p className="font-semibold">{v.types}</p>
                    <p className="text-sm text-gray-600">
                      {v.startDate} ~ {v.endDate} ({v.types})
                    </p>
                    <div className="flex justify-between items-center mt-1">
                      <span
                        className={`text-sm font-medium ${
                          v.status === "대기"
                            ? "text-blue-500"
                            : v.status === "1차 결재 완료" // 👈 1차 결재 완료 상태 추가
                            ? "text-yellow-600"
                            : v.status === "최종 승인 완료" // 👈 '승인' -> '최종 승인 완료'
                            ? "text-green-600"
                            : v.status === "반려"
                            ? "text-red-500"
                            : "text-gray-600"
                        }`}
                      >
                        {v.status}
                      </span>

                      {/* 🔽 [신규] "대기" 상태일 때만 "취소" 버튼 표시 */}
                      {v.status === "대기" && (
                        <button
                          onClick={() => handleCancelVacation(v.id)}
                          className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors"
                        >
                          취소
                        </button>
                      )}
                    </div>
                  </li>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  휴가 결재 요청 내역이 없습니다.
                </p>
              )}
            </ul>
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <div className="bg-white shadow-md border rounded-2xl p-6 w-[1200px] mx-auto">
        <h2 className="text-lg font-semibold mb-4">임직원 휴가</h2>
        <div className="w-[1100px] h-[500px] mx-auto">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="100%"
            events={events}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek,dayGridDay",
            }}
          />
        </div>
      </div>
    </div>
  );
}
