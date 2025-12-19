"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Pagination from "@/components/pagination";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// ✅ 타입 정의
interface NotificationItem {
  id: string;
  fromUserName: string;
  type: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: number;
}

const fetchNotifications = async (userName: string) => {
  const res = await fetch("/api/notifications/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName }),
  });
  const data = await res.json();
  return data.list || [];
};

function SharedBoxContent() {
  const { userName } = useSelector(
    (state: RootState) => state.auth || { userName: "사용자" }
  );
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentPage = Number(searchParams.get("page")) || 1;
  const [filterType, setFilterType] = useState("all");
  const ITEMS_PER_PAGE = 12;

  const { data: list = [], isLoading } = useQuery<NotificationItem[]>({
    queryKey: ["notifications", userName],
    queryFn: () => fetchNotifications(userName!),
    enabled: !!userName,
  });

  // 🔹 필터링 로직
  const filteredList = list.filter((item) => {
    if (filterType === "all") return true;
    return item.type === filterType;
  });

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredList.slice(offset, offset + ITEMS_PER_PAGE);

  // ✅ Record 타입 사용
  const typeLabels: Record<string, string> = {
    daily: "일일 업무",
    weekly: "주간 업무",
    report: "보고서",
    approval: "품의서",
    notice: "공지사항",
    resource: "자료실",
    vacation: "휴가원",
  };

  const colorClass: Record<string, string> = {
    daily: "bg-blue-100 text-blue-700",
    weekly: "bg-indigo-100 text-indigo-700",
    report: "bg-purple-100 text-purple-700",
    approval: "bg-pink-100 text-pink-700",
    notice: "bg-orange-100 text-orange-700",
    resource: "bg-gray-200 text-gray-700",
    vacation: "bg-red-100 text-red-700",
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterType(e.target.value);
    // 필터 변경 시 1페이지로 리셋 (URL 변경)
    router.push("?page=1");
  };

  if (isLoading) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="p-6 w-full">
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-purple-600">📭 수신/공유함</h2>

          {/* 🔹 필터 Select */}
          <select
            value={filterType}
            onChange={handleFilterChange}
            className="border p-2 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-purple-200 outline-none cursor-pointer"
          >
            <option value="all">전체 보기</option>
            <option value="daily">일일 업무</option>
            <option value="weekly">주간 업무</option>
            <option value="approval">품의서</option>
            <option value="report">보고서</option>
            <option value="vacation">휴가</option>
            <option value="notice">공지사항</option>
            <option value="resource">자료실</option>
          </select>
        </div>

        {filteredList.length === 0 ? (
          <p className="text-center text-gray-400 py-10">내역이 없습니다.</p>
        ) : (
          <ul className="divide-y">
            {currentItems.map((item) => (
              <li
                key={item.id}
                className="py-3 px-2 hover:bg-gray-50 rounded group"
              >
                <Link
                  href={item.link}
                  className="flex justify-between items-center w-full"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 text-xs font-bold rounded ${
                        colorClass[item.type] || "bg-gray-200"
                      }`}
                    >
                      {typeLabels[item.type] || item.type}
                    </span>
                    <div>
                      <p className="text-gray-800 font-medium group-hover:text-purple-600 transition-colors">
                        {item.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        보낸사람: {item.fromUserName} |{" "}
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">바로가기 &gt;</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          totalItems={filteredList.length}
          itemsPerPage={ITEMS_PER_PAGE}
          currentPage={currentPage}
        />
      </div>
    </div>
  );
}

// 2️⃣ 메인 페이지 컴포넌트 (Suspense 적용)
export default function SharedBoxPage() {
  return (
    <Suspense fallback={<div className="p-6">페이지 로딩 중...</div>}>
      <SharedBoxContent />
    </Suspense>
  );
}
