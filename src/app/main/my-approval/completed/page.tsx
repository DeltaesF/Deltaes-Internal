"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Pagination from "@/components/pagination";
import { useState } from "react";

// ✅ 타입 정의
interface CompletedItem {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  status: string;
  category: string;
}

const fetchCompleted = async (userName: string) => {
  const res = await fetch("/api/vacation/approve-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName }),
  });
  const data = await res.json();
  return (data.list || []).map((item: CompletedItem) => ({
    ...item,
    category: "vacation",
  }));
};

export default function CompletedApprovalPage() {
  const { userName } = useSelector((state: RootState) => state.auth);

  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState("all");
  const ITEMS_PER_PAGE = 15;

  const { data: list = [], isLoading } = useQuery<CompletedItem[]>({
    queryKey: ["completedHistory", userName],
    queryFn: () => fetchCompleted(userName!),
    enabled: !!userName,
  });

  const filteredList = list.filter((item) => {
    if (filterType === "all") return true;
    return item.category === filterType;
  });

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredList.slice(offset, offset + ITEMS_PER_PAGE);

  if (isLoading) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="p-6 w-full">
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-green-600">✅ 결재 완료함</h2>

          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setCurrentPage(1);
            }}
            className="border p-2 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-green-200 outline-none cursor-pointer"
          >
            <option value="all">전체 보기</option>
            <option value="vacation">휴가</option>
          </select>
        </div>

        {filteredList.length === 0 ? (
          <p className="text-center text-gray-400 py-10">
            완료된 결재 내역이 없습니다.
          </p>
        ) : (
          <ul className="divide-y">
            {currentItems.map((item) => (
              <li key={item.id} className="py-4 px-2 hover:bg-gray-50 rounded">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">
                        승인완료
                      </span>
                      <span className="font-bold text-gray-800">
                        {item.userName}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 ml-1">
                      ({item.startDate} ~ {item.endDate})
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    {item.status}
                  </span>
                </div>
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
