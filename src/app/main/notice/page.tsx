"use client";

import { useEffect, useState } from "react";
import NoticeWrite from "./write/page";
import NoticeDetail from "./noticeDetail";

type Notice = {
  id: string;
  title: string;
  content: string;
  userName: string;
  fileUrl?: string | null;
  createdAt: number;
};

export default function Notice() {
  const [activeTab, setActiveTab] = useState<"list" | "write">("list");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  const renderContent = () => {
    if (selectedNotice) {
      return (
        <NoticeDetail
          notice={selectedNotice}
          onBack={() => setSelectedNotice(null)}
        />
      );
    }

    if (activeTab === "write")
      return <NoticeWrite onCancel={() => setActiveTab("list")} />;
    return null;
  };

  const loadReports = async () => {
    try {
      const res = await fetch("/api/notice/list");
      const data = await res.json();
      setNotices(Array.isArray(data) ? data : []);
      console.log("Loaded notices:", data);
    } catch (error) {
      console.error("Failed to load notices:", error);
      setNotices([]);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  // 날짜 포맷팅 헬퍼
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
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
        {activeTab === "list" && !selectedNotice && (
          <div className="border rounded-2xl shadow-sm p-4 bg-white">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[20px] font-semibold">공지사항</h3>
              <span className="text-sm text-blue-500 cursor-pointer hover:underline">
                + 더보기
              </span>
            </div>

            <ul>
              {notices?.map((item) => (
                <li
                  key={item.id}
                  className="py-2 border-b flex justify-between items-center cursor-pointer hover:bg-gray-50 group"
                  onClick={() => setSelectedNotice(item)}
                >
                  <p className="hover:text-purple-400 transition-colors truncate">
                    {item.title}
                  </p>

                  <div className="flex items-center gap-[15px] text-xs text-gray-500 flex-shrink-0">
                    <span className="font-medium text-gray-500">
                      {item.userName}
                    </span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </li>
              ))}
              {notices.length === 0 && (
                <li className="py-2 text-gray-400">
                  등록된 공지사항이 없습니다.
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="w-full">{renderContent()}</div>
      </div>
    </div>
  );
}
