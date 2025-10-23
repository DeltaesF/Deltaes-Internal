// src/app/individual/Individual.tsx
"use client";

import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

type EventType = {
  id?: string;
  title: string;
  start: string;
  end?: string;
};

type VacationType = {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  approvers: { first?: string[]; second?: string[] };
};

export default function Individual() {
  // Redux로부터 userDocId(예: "홍성원 프로"), userName(예: "홍성원"), loading 상태를 가져옵니다.
  const { userDocId, userName, loading, role } = useSelector(
    (state: RootState) => state.auth
  );

  const [events, setEvents] = useState<EventType[]>([]);
  const [pendingList, setPendingList] = useState<VacationType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedVacation, setSelectedVacation] = useState<VacationType | null>(
    null
  );

  // ✅ 결재 대기 리스트 불러오기
  const fetchPending = async () => {
    if (!userName) return;
    try {
      const res = await fetch("/api/vacation/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, userName }), // ✅ role 추가
      });
      const data = await res.json();
      if (res.ok) setPendingList(data.list || []);
    } catch (err) {
      console.error("결재 대기 조회 실패:", err);
    }
  };

  // ✅ 이벤트 불러오기 (기존)
  const fetchEvents = async () => {
    if (!userDocId) return;
    const res = await fetch(
      `/api/today/list?docId=${encodeURIComponent(userDocId)}`
    );
    const data = await res.json();
    setEvents(data);
  };

  // userDocId가 바뀌면(로그인 또는 initAuth 완료 시) 이벤트를 불러옵니다.
  useEffect(() => {
    if (!loading) {
      fetchEvents();
      fetchPending();
    }
  }, [loading, userDocId]);

  // ✅ 승인 처리
  const handleApprove = async (vacationId: string) => {
    try {
      const res = await fetch("/api/vacation/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacationId,
          approverName: userName,
        }),
      });

      if (!res.ok) throw new Error("승인 실패");
      alert("승인되었습니다.");
      fetchPending(); // 새로고침
      setSelectedVacation(null);
    } catch (err) {
      console.error("승인 오류:", err);
    }
  };

  // 날짜 클릭 → 기간 입력 → API로 전송
  const handleDateClick = async (arg: DateClickArg) => {
    if (!userDocId) {
      alert("로그인 후 이용 가능합니다.");
      return;
    }

    // 1) 제목 입력
    const title = prompt("일정을 입력하세요:");
    if (!title) return;

    // 2) 시작일/종료일 입력 (YYYY-MM-DD)
    const startInput = prompt("시작일 (YYYY-MM-DD)", arg.dateStr);
    if (!startInput) return;
    const endInput = prompt("종료일 (YYYY-MM-DD)", startInput);
    if (!endInput) return;

    // FullCalendar는 end를 exclusive로 처리하므로 마지막 날짜를 포함하려면 +1일
    const endDate = new Date(endInput);
    endDate.setDate(endDate.getDate() + 1);
    const end = endDate.toISOString().split("T")[0];
    const start = startInput; // yyyy-mm-dd 형태

    try {
      // API에 docId를 포함하여 POST
      const res = await fetch("/api/today/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: userDocId, title, start, end }),
      });

      if (!res.ok) throw new Error("Failed to add event");
      // 저장 성공 후 다시 불러오기
      await fetchEvents();
    } catch (err) {
      console.error("handleDateClick error:", err);
      alert("일정 추가 실패");
    }
  };

  const handleDateDelete = async (eventId: string) => {
    if (!userDocId) return;
    const confirmDelete = confirm("일정을 삭제하시겠습니까?");
    if (!confirmDelete) return;

    try {
      const res = await fetch("/api/today/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: userDocId, eventId }),
      });
      if (!res.ok) throw new Error("Failed to delete event");

      // 삭제 후 이벤트 다시 가져오기
      fetchEvents();
    } catch (err) {
      console.error("Delete event error:", err);
      alert("이벤트 삭제 실패");
    }
  };

  if (loading) return <p>로딩 중...</p>;

  return (
    <div className="flex flex-col gap-12 mt-6 items-center">
      <div className="flex justify-center gap-30">
        <div
          className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center cursor-pointer"
          onClick={() => setShowModal(true)}
        >
          <span className="text-gray-600 font-medium">결재 요청</span>
          <p className="text-4xl font-bold">{pendingList.length} 건</p>
        </div>
        <div className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center">
          <span className="text-gray-600 font-medium">결재 완료</span>
          <p className="text-4xl font-bold">0 건</p>
        </div>
        <div className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center">
          <span className="text-gray-600 font-medium">오늘</span>
          <p className="text-4xl font-bold">0 건</p>
        </div>
      </div>

      {/* 🔹 모달: 결재 요청 목록 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl p-6 w-[600px]">
            <h3 className="text-lg font-bold mb-4">결재 요청 목록</h3>
            <ul className="divide-y">
              {pendingList.length > 0 ? (
                pendingList.map((v) => (
                  <li
                    key={v.id}
                    className="py-3 cursor-pointer hover:bg-gray-100 px-2"
                    onClick={() => setSelectedVacation(v)}
                  >
                    <p className="font-semibold">{v.userName}</p>
                    <p className="text-sm text-gray-600">
                      {v.startDate} ~ {v.endDate} ({v.reason})
                    </p>
                    <span className="text-xs text-blue-500">{v.status}</span>
                  </li>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  대기 중인 결재가 없습니다.
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

      {/* 🔹 승인 상세 모달 */}
      {selectedVacation && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl p-6 w-[500px]">
            <h3 className="text-lg font-bold mb-3">휴가 승인</h3>
            <p>
              <strong>신청자:</strong> {selectedVacation.userName}
            </p>
            <p>
              <strong>기간:</strong> {selectedVacation.startDate} ~{" "}
              {selectedVacation.endDate}
            </p>
            <p>
              <strong>사유:</strong> {selectedVacation.reason}
            </p>
            <p>
              <strong>상태:</strong> {selectedVacation.status}
            </p>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => handleApprove(selectedVacation.id)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                승인
              </button>
              <button
                onClick={() => setSelectedVacation(null)}
                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-md border rounded-2xl p-6 w-[1200px] mx-auto">
        <h2 className="text-lg font-semibold mb-4">
          📅 {userName ? `${userName}님의 일정 캘린더` : "내 일정"}
        </h2>
        <div className="w-[1100px] h-[500px] mx-auto">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={events}
            dateClick={handleDateClick}
            eventClick={(clickInfo) => {
              handleDateDelete(clickInfo.event.id); // 삭제
            }}
            height="100%"
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
