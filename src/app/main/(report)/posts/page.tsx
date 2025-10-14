"use client";

import { useState } from "react";
import ReportWrite from "../write/page";
// import WorkOutsideWrite2 from "../write2/page";
// import WorkOutsideWrite3 from "../write3/page";

export default function Posts() {
  const [activeTab, setActiveTab] = useState<
    "list" | "write" | "write2" | "write3"
  >("list");

  const [isWriteOpen, setIsWriteOpen] = useState(false);

  const renderContent = () => {
    if (activeTab === "write")
      return <ReportWrite onCancel={() => setActiveTab("list")} />;
    // if (activeTab === "write2")
    //   return <WorkOutsideWrite2 onCancel={() => setActiveTab("list")} />;
    // if (activeTab === "write3")
    //   return <WorkOutsideWrite3 onCancel={() => setActiveTab("list")} />;
    return null;
  };

  return (
    <div className="flex flex-col w-full">
      {activeTab === "list" && (
        <div className="flex mb-6 items-center relative">
          <div className="ml-auto relative">
            <button
              onClick={() => setIsWriteOpen((prev) => !prev)}
              className="px-4 py-2 rounded-xl border border-[#519d9e] hover:bg-[#519d9e] hover:text-white cursor-pointer"
            >
              글작성 ▾
            </button>

            {/* 드롭다운 메뉴 */}
            {isWriteOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-[#519d9e] rounded shadow-lg flex flex-col z-10">
                <button
                  onClick={() => {
                    setActiveTab("write");
                    setIsWriteOpen(false);
                  }}
                  className="px-4 py-2 text-left hover:bg-[#B1B1B1] hover:text-black rounded-t cursor-pointer"
                >
                  Write 1
                </button>
                <button
                  onClick={() => {
                    setActiveTab("write2");
                    setIsWriteOpen(false);
                  }}
                  className="px-4 py-2 text-left hover:bg-[#B1B1B1] hover:text-black cursor-pointer"
                >
                  Write 2
                </button>
                <button
                  onClick={() => {
                    setActiveTab("write3");
                    setIsWriteOpen(false);
                  }}
                  className="px-4 py-2 text-left hover:bg-[#B1B1B1] hover:text-black rounded-b cursor-pointer"
                >
                  Write 3
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="w-full">
        {activeTab === "list" && (
          <div className="border rounded-2xl shadow-sm p-4 bg-white">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[20px] font-semibold">보고서</h3>
              <span className="text-sm text-blue-500 cursor-pointer hover:underline">
                + 더보기
              </span>
            </div>
            <ul>
              <li className="py-2 border-b">보고서 내용 1</li>
              <li className="py-2 border-b">보고서 내용 2</li>
              <li className="py-2 border-b">보고서 내용 3</li>
            </ul>
          </div>
        )}

        <div className="w-full">{renderContent()}</div>
      </div>
    </div>
  );
}
