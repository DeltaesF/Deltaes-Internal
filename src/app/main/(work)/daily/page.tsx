"use client";

import { useEffect, useState } from "react";
import DailyDetail from "./dailyDetail";

type Daily = {
  id: string;
  title: string;
  content: string;
  userName: string;
  fileUrl?: string | null;
  createdAt: number;
};

export default function Daily() {
  const [daily, setDaily] = useState<Daily[]>([]);
  const [selectedDaily, setSelectedDaily] = useState<Daily | null>(null);

  // 데이터 불러오기
  const loadDailys = async () => {
    try {
      // API 경로가 기존과 동일한지, 아니면 /api/daily/list 처럼 다른지 확인이 필요합니다.
      // 여기서는 예시로 기존 코드를 따릅니다.
      const res = await fetch("/api/daily/list");
      const data = await res.json();
      setDaily(Array.isArray(data) ? data : []);
      console.log("Loaded daily reports:", data);
    } catch (error) {
      console.error("Failed to load reports:", error);
      setDaily([]);
    }
  };

  useEffect(() => {
    loadDailys();
  }, []);

  if (selectedDaily) {
    return (
      <DailyDetail
        daily={selectedDaily}
        onBack={() => setSelectedDaily(null)}
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
        <h3 className="text-[20px] font-semibold">일일 업무 보고서</h3>
        <span className="text-sm text-blue-500 cursor-pointer hover:underline">
          + 더보기
        </span>
      </div>

      <ul>
        {daily.map((item) => (
          <li
            key={item.id}
            className="py-2 border-b flex justify-between items-center cursor-pointer hover:bg-gray-50 group"
            onClick={() => setSelectedDaily(item)}
          >
            <p className="hover:text-purple-400 transition-colors">
              {item.title}
            </p>
            <span className="text-xs text-gray-400">
              {formatDate(item.createdAt)}
            </span>
          </li>
        ))}

        {daily.length === 0 && (
          <li className="py-2 text-gray-400">
            등록된 일일 업무 보고서가 없습니다.
          </li>
        )}
      </ul>
    </div>
  );
}
