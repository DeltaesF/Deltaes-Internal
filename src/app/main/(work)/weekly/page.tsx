"use client";

import { useEffect, useState } from "react";
import WeeklyDetail from "./weeklyDetail";

type Weekly = {
  id: string;
  title: string;
  content: string;
  userName: string;
  fileUrl?: string | null;
  createdAt: number;
};

export default function Weekly() {
  const [weekly, setWeekly] = useState<Weekly[]>([]);
  const [selectedWeekly, setSelectedWeekly] = useState<Weekly | null>(null);

  // 데이터 불러오기
  const loadDailys = async () => {
    try {
      // API 경로가 기존과 동일한지, 아니면 /api/weekly/list 처럼 다른지 확인이 필요합니다.
      // 여기서는 예시로 기존 코드를 따릅니다.
      const res = await fetch("/api/weekly/list");
      const data = await res.json();
      setWeekly(Array.isArray(data) ? data : []);
      console.log("Loaded weekly reports:", data);
    } catch (error) {
      console.error("Failed to load reports:", error);
      setWeekly([]);
    }
  };

  useEffect(() => {
    loadDailys();
  }, []);

  if (selectedWeekly) {
    return (
      <WeeklyDetail
        weekly={selectedWeekly}
        onBack={() => setSelectedWeekly(null)}
      />
    );
  }

  // 날짜 포맷팅 헬퍼
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <div className="border rounded-2xl shadow-sm p-4 bg-white">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-[20px] font-semibold">주간 업무 보고서</h3>
        <span className="text-sm text-blue-500 cursor-pointer hover:underline">
          + 더보기
        </span>
      </div>

      <ul>
        {weekly.map((item) => (
          <li
            key={item.id}
            className="py-2 border-b flex justify-between items-center cursor-pointer hover:bg-gray-50 group"
            onClick={() => setSelectedWeekly(item)}
          >
            <p className="hover:text-purple-400 transition-colors truncate">
              {item.title}
            </p>

            <div className="flex items-center gap-[15px] text-xs text-gray-500 flex-shrink-0">
              <span className="font-medium text-gray-500">{item.userName}</span>
              <span>{formatDate(item.createdAt)}</span>
            </div>
          </li>
        ))}

        {weekly.length === 0 && (
          <li className="py-2 text-gray-400">
            등록된 주간 업무 보고서가 없습니다.
          </li>
        )}
      </ul>
    </div>
  );
}
