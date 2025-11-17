"use client";

import { useState } from "react";
import NoticeWrite from "./write/page";

export default function Notice() {
  const [activeTab, setActiveTab] = useState<"list" | "write">("list");

  const renderContent = () => {
    if (activeTab === "write")
      return <NoticeWrite onCancel={() => setActiveTab("list")} />;
    return null;
  };
  return (
    <div className="flex flex-col w-full">
      {activeTab === "list" && (
        <div className="flex mb-6 items-center relative">
          <div className="ml-auto relative">
            <button
              onClick={() => setActiveTab("write")}
              className="px-4 py-2 rounded-xl border border-[#519d9e] hover:bg-[#519d9e] hover:text-white cursor-pointer"
            >
              글작성 ▾
            </button>
          </div>
        </div>
      )}

      <div className="w-full">
        {activeTab === "list" && (
          <div className="border rounded-2xl shadow-sm p-4 bg-white">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[20px] font-semibold">공지사항</h3>
              <span className="text-sm text-blue-500 cursor-pointer hover:underline">
                + 더보기
              </span>
            </div>
            <ul>
              <li className="py-2 border-b">공지사항 내용 1</li>
              <li className="py-2 border-b">공지사항 내용 2</li>
              <li className="py-2 border-b">공지사항 내용 3</li>
            </ul>
          </div>
        )}

        <div className="w-full">{renderContent()}</div>
      </div>
    </div>
  );
}
