"use client";

import { useEffect, useState } from "react";
import ResourcesWrite from "./write/page";
import ResourcesDetail from "./resourcesDetail";

type Resources = {
  id: string;
  title: string;
  content: string;
  userName: string;
  fileUrl?: string | null;
  createdAt: number;
};

export default function Resources() {
  const [activeTab, setActiveTab] = useState<"list" | "write">("list");
  const [resources, setResources] = useState<Resources[]>([]);
  const [selectedResource, setSelectedResources] = useState<Resources | null>(
    null
  );

  const renderContent = () => {
    if (selectedResource) {
      return (
        <ResourcesDetail
          resource={selectedResource}
          onBack={() => setSelectedResources(null)}
        />
      );
    }

    if (activeTab === "write")
      return <ResourcesWrite onCancel={() => setActiveTab("list")} />;
    return null;
  };

  const loadReports = async () => {
    try {
      const res = await fetch("/api/resources/list");
      const data = await res.json();
      setResources(Array.isArray(data) ? data : []);
      console.log("Loaded resources:", data);
    } catch (error) {
      console.error("Failed to load resources:", error);
      setResources([]);
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
        {activeTab === "list" && !selectedResource && (
          <div className="border rounded-2xl shadow-sm p-4 bg-white">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[20px] font-semibold">자료실</h3>
              <span className="text-sm text-blue-500 cursor-pointer hover:underline">
                + 더보기
              </span>
            </div>

            <ul>
              {resources?.map((item) => (
                <li
                  key={item.id}
                  className="py-2 border-b flex justify-between items-center cursor-pointer hover:bg-gray-50 group"
                  onClick={() => setSelectedResources(item)}
                >
                  <p className="hover:text-purple-400 transition-colors">
                    {item.title}
                  </p>
                  <span className="text-xs text-gray-400">
                    {formatDate(item.createdAt)}
                  </span>
                </li>
              ))}
              {resources.length === 0 && (
                <li className="py-2 text-gray-400">등록된 자료가 없습니다.</li>
              )}
            </ul>
          </div>
        )}

        <div className="w-full">{renderContent()}</div>
      </div>
    </div>
  );
}
