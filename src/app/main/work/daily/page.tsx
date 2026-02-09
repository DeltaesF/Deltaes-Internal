"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Link from "next/link";
import { useState, Suspense } from "react";

interface DailyReport {
  id: string;
  title: string;
  userName: string;
  createdAt: number;
  content?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  commentCount?: number;
}

interface DailyApiResponse {
  list: DailyReport[];
  totalCount: number;
}

const fetchMyDailys = async (
  userName: string,
  role: string,
  page: number,
  limit: number
) => {
  const res = await fetch("/api/daily/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, role, page, limit }),
  });
  if (!res.ok) {
    throw new Error("Failed to fetch data");
  }
  return res.json();
};

function DailyContent() {
  const { userName, role } = useSelector((state: RootState) => state.auth);

  // ✅ 상태 기반 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 18;

  const { data, isLoading } = useQuery<DailyApiResponse>({
    queryKey: ["dailys", userName, currentPage], // 페이지 변경 시 자동 재요청
    queryFn: () =>
      fetchMyDailys(userName || "", role || "", currentPage, ITEMS_PER_PAGE),
    enabled: !!userName,
    placeholderData: (prev) => prev, // 로딩 중 이전 데이터 유지 (깜빡임 방지)
  });

  const dailyList = data?.list || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;

  // 페이지 변경 핸들러
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  if (isLoading && !data)
    return <div className="p-4 text-gray-500">로딩 중...</div>;

  return (
    <div className="flex flex-col w-full p-6">
      <div className="border rounded-2xl shadow-sm p-6 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xl font-semibold">일일 업무 보고서</h3>
          <Link
            href="/main/work/dailywrite"
            prefetch={false}
            className="px-4 py-2 rounded-xl border border-[#51709e] hover:bg-[#51709e] hover:text-white cursor-pointer text-sm transition-colors"
          >
            글작성 ✎
          </Link>
        </div>

        {dailyList.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            등록된 일일 업무 보고서가 없습니다.
          </div>
        ) : (
          <>
            <ul>
              {dailyList.map((item) => (
                <li
                  key={item.id}
                  className="border-b border-gray-400  group hover:bg-gray-50 transition-colors"
                >
                  <Link
                    href={`/main/work/daily/${item.id}`}
                    prefetch={false}
                    className="flex justify-between items-center w-full py-1"
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      <span className="text-[#51709e] font-bold whitespace-nowrap">
                        [일일]
                      </span>
                      <p className="text-ms text-gray-800 truncate group-hover:text-[#51709e] transition-colors">
                        {item.title}
                        {/* 코멘트 개수가 있으면 표시 */}
                        {item.commentCount && item.commentCount > 0 ? (
                          <span className="text-red-500 text-xs font-bold ml-1">
                            (+{item.commentCount})
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-shrink-0">
                      <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                        {item.userName}
                      </span>
                      <span>
                        {new Date(item.createdAt).toLocaleDateString("ko-KR", {
                          year: "2-digit",
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {/* ✅ 페이지네이션 버튼 UI */}
            <div className="flex justify-center items-center gap-4 mt-6 py-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                  currentPage === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                    : "bg-white text-gray-700 hover:bg-gray-50 hover:text-blue-600 border-gray-300"
                }`}
              >
                ◀ 이전
              </button>

              <span className="text-sm font-medium text-gray-600">
                Page{" "}
                <span className="text-blue-600 font-bold">{currentPage}</span> /{" "}
                {totalPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                  currentPage === totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                    : "bg-white text-gray-700 hover:bg-gray-50 hover:text-blue-600 border-gray-300"
                }`}
              >
                다음 ▶
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Daily() {
  return (
    <Suspense
      fallback={<div className="p-6 text-center">페이지 로딩 중...</div>}
    >
      <DailyContent />
    </Suspense>
  );
}
