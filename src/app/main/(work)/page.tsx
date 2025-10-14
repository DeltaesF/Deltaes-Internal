"use client";

import { useState } from "react";
import Daily from "./daily/page";
import Weekly from "./weekly/page";
import ReportDaily from "./dailywrite/page";
import ReportWeekly from "./weeklywrite/page";

export default function Work() {
  const [activeTab, setActiveTab] = useState<
    "daily" | "weekly" | "reportWrite" | "weeklyWrite"
  >("daily");
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  const renderContent = () => {
    if (activeTab === "daily") return <Daily />;
    if (activeTab === "weekly") return <Weekly />;
    if (activeTab === "reportWrite")
      return <ReportDaily onCancel={() => setActiveTab("daily")} />;
    if (activeTab === "weeklyWrite")
      return <ReportWeekly onCancel={() => setActiveTab("weekly")} />;
    return null;
  };

  return (
    <div className="flex flex-col w-full">
      <div className="flex gap-4 mb-6 items-center relative">
        {/* Daily / Weekly 버튼: 작성 화면이면 숨김 */}
        {activeTab !== "reportWrite" && activeTab !== "weeklyWrite" && (
          <>
            <button
              onClick={() => setActiveTab("daily")}
              className={`px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
                activeTab === "daily"
                  ? "bg-[#78D2FF] text-black border-[#78D2FF]"
                  : "bg-white border border-[#78D2FF] text-black hover:bg-[#78D2FF] hover:text-white"
              }`}
            >
              일일보고
            </button>
            <button
              onClick={() => setActiveTab("weekly")}
              className={`px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
                activeTab === "weekly"
                  ? "bg-[#53F36B] text-black border-[#53F36B]"
                  : "bg-white border border-[#53F36B] text-black hover:bg-[#53F36B] hover:text-white"
              }`}
            >
              주간업무
            </button>
          </>
        )}

        {/* 글작성 select 버튼 */}
        {activeTab !== "reportWrite" && activeTab !== "weeklyWrite" && (
          <div className="ml-auto relative">
            <button
              onClick={() => setIsWriteOpen((prev) => !prev)}
              className="px-4 py-2 rounded-xl border border-[#519d9e] hover:bg-[#519d9e] hover:text-white cursor-pointer"
            >
              글작성 ▾
            </button>

            {isWriteOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-[#519d9e] rounded shadow-lg flex flex-col z-10 ">
                <button
                  onClick={() => {
                    setActiveTab("reportWrite");
                    setIsWriteOpen(false);
                  }}
                  className="px-4 py-2 text-left hover:bg-[#78D2FF] hover:text-black rounded-t cursor-pointer"
                >
                  일일보고 작성
                </button>
                <button
                  onClick={() => {
                    setActiveTab("weeklyWrite");
                    setIsWriteOpen(false);
                  }}
                  className="px-4 py-2 text-left hover:bg-[#53F36B] hover:text-black rounded-b cursor-pointer"
                >
                  주간업무 작성
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="w-full">{renderContent()}</div>
    </div>
  );
}
