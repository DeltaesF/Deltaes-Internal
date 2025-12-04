"use client";

import { useEffect, useState } from "react";
import ReportWrite from "../write/page";
import ReportDetail from "./reportDetail";
// import WorkOutsideWrite2 from "../write2/page";
// import WorkOutsideWrite3 from "../write3/page";

type Report = {
  id: string;
  title: string;
  content: string;
  userName: string;
  fileUrl?: string | null;
  createdAt: number;
};

export default function Posts() {
  const [activeTab, setActiveTab] = useState<
    "list" | "write" | "write2" | "write3"
  >("list");

  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const renderContent = () => {
    if (selectedReport) {
      return (
        <ReportDetail
          report={selectedReport}
          onBack={() => setSelectedReport(null)}
        />
      );
    }

    if (activeTab === "write")
      return <ReportWrite onCancel={() => setActiveTab("list")} />;
    // if (activeTab === "write2")
    //   return <WorkOutsideWrite2 onCancel={() => setActiveTab("list")} />;
    // if (activeTab === "write3")
    //   return <WorkOutsideWrite3 onCancel={() => setActiveTab("list")} />;
    return null;
  };

  const loadReports = async () => {
    try {
      const res = await fetch("/api/report/list");
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
      console.log("Loaded reports:", data);
    } catch (error) {
      console.error("Failed to load reports:", error);
      setReports([]);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

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
                  보고서 작성
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

      {/* 리스트 */}
      <div className="w-full">
        {activeTab === "list" && !selectedReport && (
          <div className="border rounded-2xl shadow-sm p-4 bg-white">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[20px] font-semibold">보고서</h3>
              <span className="text-sm text-blue-500 cursor-pointer hover:underline">
                + 더보기
              </span>
            </div>

            <ul>
              {reports?.map((item) => (
                <li
                  key={item.id}
                  className="py-2 border-b cursor-pointer "
                  onClick={() => setSelectedReport(item)}
                >
                  <p className="hover:text-purple-400 transition-colors">
                    {item.title}
                  </p>
                </li>
              ))}
              {reports.length === 0 && (
                <li className="py-2 text-gray-400">
                  등록된 보고서가 없습니다.
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
