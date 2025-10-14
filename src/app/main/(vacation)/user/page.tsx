"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { useState } from "react";
import VacationWrite from "../write/page";

export default function UserV() {
  const [activeTab, setActiveTab] = useState<"vacation" | "vacationWrite">(
    "vacation"
  );

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

      <div className="flex justify-center gap-30">
        <div className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center">
          <span className="text-gray-600 font-medium">미사용 휴가 일수</span>
          <p className="text-4xl font-bold">0 개</p>
        </div>
        <div className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center">
          <span className="text-gray-600 font-medium">사용 휴가 일수</span>
          <p className="text-4xl font-bold">0 개</p>
        </div>
        <div className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center">
          <span className="text-gray-600 font-medium">휴가 결재 요청</span>
          <p className="text-4xl font-bold">0 건</p>
        </div>
      </div>

      <div className="bg-white shadow-md border rounded-2xl p-6 w-[1200px] mx-auto">
        <h2 className="text-lg font-semibold mb-4">
          {/* 📅 {userName ? `${userName}님의 일정 캘린더` : "내 일정"} */}
          임직원 휴가
        </h2>
        <div className="w-[1100px] h-[500px] mx-auto">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
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
