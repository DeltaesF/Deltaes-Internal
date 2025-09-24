"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { DateClickArg } from "@fullcalendar/interaction";

export default function Individual() {
  const [events, setEvents] = useState<{ title: string; date: string }[]>([
    { title: "회의", date: "2025-09-20" },
    { title: "프로젝트 마감", date: "2025-09-25" },
  ]);

  // 날짜 클릭 → 일정 추가
  const handleDateClick = (arg: DateClickArg) => {
    const title = prompt("일정을 입력하세요:");
    if (title) {
      setEvents([...events, { title, date: arg.dateStr }]);
    }
  };

  return (
    <div className="flex flex-col gap-12 mt-6">
      <div className="flex justify-center gap-30">
        <div className="bg-white shadow-md border rounded-2xl p-6 w-80">
          <span className="text-gray-600 font-medium">결재 요청</span>
          <p className="text-4xl font-bold text-right">12 건</p>
        </div>
        <div className="bg-white shadow-md border rounded-2xl p-6 w-80">
          <span className="text-gray-600 font-medium">결재 완료</span>
          <p className="text-4xl font-bold text-right">8 건</p>
        </div>
        <div className="bg-white shadow-md border rounded-2xl p-6 w-80">
          <span className="text-gray-600 font-medium">오늘</span>
          <p className="text-4xl font-bold text-right">3 건</p>
        </div>
      </div>

      <div className="bg-white shadow-md border rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">📅 일정 캘린더</h2>
        <div className="h-[500px]">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={events}
            dateClick={handleDateClick}
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
