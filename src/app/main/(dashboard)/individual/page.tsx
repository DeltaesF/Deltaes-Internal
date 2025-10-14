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

export default function Individual() {
  // Redux로부터 userDocId(예: "홍성원 프로"), userName(예: "홍성원"), loading 상태를 가져옵니다.
  const { userDocId, userName, loading } = useSelector(
    (state: RootState) => state.auth
  );

  const [events, setEvents] = useState<EventType[]>([]);

  // 서버 API에서 events를 가져오는 함수
  const fetchEvents = async () => {
    if (!userDocId) return; // 로그인/employee 매칭 안된 경우에는 호출하지 않음

    try {
      // docId를 쿼리스트링으로 전달
      const res = await fetch(
        `/api/today/list?docId=${encodeURIComponent(userDocId)}`
      );
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      // API는 FullCalendar 형식({title, start, end})을 반환하므로 그대로 사용
      setEvents(data);
    } catch (err) {
      console.error("fetchEvents error:", err);
    }
  };

  // userDocId가 바뀌면(로그인 또는 initAuth 완료 시) 이벤트를 불러옵니다.
  useEffect(() => {
    if (!loading) fetchEvents();
  }, [loading, userDocId]);

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
        <div className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center">
          <span className="text-gray-600 font-medium">결재 요청</span>
          <p className="text-4xl font-bold">0 건</p>
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
