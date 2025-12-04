"use client";

import { useEffect, useState } from "react";
import WorkOutsideWrite from "../write/page";
import ApprovalsDetail from "./approvalsDetail";
// import WorkOutsideWrite2 from "../write2/page";
// import WorkOutsideWrite3 from "../write3/page";

type Approvals = {
  id: string;
  title: string;
  content: string;
  userName: string;
  fileUrl?: string | null;
  createdAt: number;
};

export default function Approvals() {
  const [activeTab, setActiveTab] = useState<
    "list" | "write" | "write2" | "write3"
  >("list");

  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [approvals, setApprovals] = useState<Approvals[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<Approvals | null>(
    null
  );

  const renderContent = () => {
    if (selectedApproval) {
      return (
        <ApprovalsDetail
          approval={selectedApproval}
          onBack={() => setSelectedApproval(null)}
        />
      );
    }

    if (activeTab === "write")
      return <WorkOutsideWrite onCancel={() => setActiveTab("list")} />;
    // if (activeTab === "write2")
    //   return <WorkOutsideWrite2 onCancel={() => setActiveTab("list")} />;
    // if (activeTab === "write3")
    //   return <WorkOutsideWrite3 onCancel={() => setActiveTab("list")} />;
    return null;
  };

  const loadReports = async () => {
    try {
      const res = await fetch("/api/approvals/list");
      const data = await res.json();
      setApprovals(Array.isArray(data) ? data : []);
      console.log("Loaded approvals:", data);
    } catch (error) {
      console.error("Failed to load approvals:", error);
      setApprovals([]);
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
                  품의서 작성
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
        {activeTab === "list" && !selectedApproval && (
          <div className="border rounded-2xl shadow-sm p-4 bg-white">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[20px] font-semibold">품의서</h3>
              <span className="text-sm text-blue-500 cursor-pointer hover:underline">
                + 더보기
              </span>
            </div>

            <ul>
              {approvals?.map((item) => (
                <li
                  key={item.id}
                  className="py-2 border-b flex justify-between items-center cursor-pointer hover:bg-gray-50 group"
                  onClick={() => setSelectedApproval(item)}
                >
                  <p className="hover:text-purple-400 transition-colors">
                    {item.title}
                  </p>
                  <span className="text-xs text-gray-400">
                    {formatDate(item.createdAt)}
                  </span>
                </li>
              ))}
              {approvals.length === 0 && (
                <li className="py-2 text-gray-400">
                  등록된 품의서가 없습니다.
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
