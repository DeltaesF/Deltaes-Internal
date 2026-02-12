"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

// 타입 정의
interface ReportItem {
  id: string;
  title: string;
  userName: string;
  department: string;
  status: string;
  createdAt: number;
}

interface ApiResponse {
  list: ReportItem[];
  totalCount: number;
}

const fetchReports = async (page: number, limit: number) => {
  const res = await fetch("/api/report/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      page,
      limit,
      reportType: "internal_edu", // ✅ 사내교육보고서 필터
    }),
  });
  if (!res.ok) throw new Error("Failed to fetch reports");
  return res.json();
};

function InternalReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPage = Number(searchParams.get("page")) || 1;
  const ITEMS_PER_PAGE = 12; // ✅ 읽기 비용 최적화를 위해 12개로 조정

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ["reports", "internal", currentPage],
    queryFn: () => fetchReports(currentPage, ITEMS_PER_PAGE),
    placeholderData: (prev) => prev, // ✅ [최적화] 로딩 중 이전 데이터 유지 (깜빡임 방지)
    refetchOnMount: true,
  });

  const list = data?.list || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;

  // 페이지 변경 핸들러
  const handlePrevPage = () => {
    if (currentPage > 1) router.push(`?page=${currentPage - 1}`);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) router.push(`?page=${currentPage + 1}`);
  };

  if (isLoading && !data)
    return <div className="p-10 text-center">로딩 중...</div>;

  return (
    <div className="flex flex-col w-full p-4 md:p-6 min-w-0">
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-6">
        {/* 상단 헤더 영역: 모바일에서는 세로로 배치될 수 있도록 gap 추가 */}
        <div className="flex justify-between items-center mb-5 gap-4">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 truncate">
            사내 교육 보고서
          </h2>
          <Link
            href="/main/report/internal/write"
            prefetch={false}
            className="px-3 py-2 md:px-4 md:py-2 bg-[#519d9e] text-white rounded-xl hover:bg-[#407f80] transition-colors font-bold text-xs md:text-sm whitespace-nowrap"
          >
            보고서 작성 ✎
          </Link>
        </div>

        {/* 리스트 영역: 일일 보고서 스타일 적용 */}
        {list.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">
            등록된 보고서가 없습니다.
          </div>
        ) : (
          <>
            <ul className="w-full">
              {list.map((item) => (
                <li
                  key={item.id}
                  className="border-b border-gray-400 group hover:bg-gray-50 transition-colors"
                >
                  <Link
                    href={`/main/report/${item.id}`}
                    prefetch={false}
                    className="flex justify-between items-center w-full py-2 px-1 gap-4"
                  >
                    {/* 왼쪽 영역: 제목이 길어지면 줄여줌 */}
                    <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                      <p className="text-sm md:text-[15px] text-gray-800 truncate group-hover:text-[#519d9e] transition-colors font-medium ">
                        {item.title}
                      </p>
                    </div>

                    {/* 오른쪽 영역: 작성자와 날짜 (공간 부족 시 shrink 보호) */}
                    <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-gray-500 shrink-0">
                      <span className="sm:hidden font-semibold text-gray-700 bg-gray-100  rounded max-w-[60px]">
                        {item.userName}
                      </span>
                      <span className="whitespace-nowrap text-gray-400">
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

            {/* 페이지네이션 버튼: 기기별 패딩 조절 */}
            <div className="flex justify-center items-center gap-2 md:gap-4 mt-8 py-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg border text-xs md:text-sm font-medium transition-colors cursor-pointer ${
                  currentPage === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                    : "bg-white text-gray-700 hover:bg-gray-50 hover:text-[#519d9e] border-gray-300 shadow-sm"
                }`}
              >
                ◀ 이전
              </button>

              <span className="text-xs md:text-sm font-medium text-gray-600 whitespace-nowrap">
                Page{" "}
                <span className="text-[#519d9e] font-bold">{currentPage}</span>{" "}
                / {totalPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg border text-xs md:text-sm font-medium transition-colors cursor-pointer ${
                  currentPage === totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                    : "bg-white text-gray-700 hover:bg-gray-50 hover:text-[#519d9e] border-gray-300 shadow-sm"
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

export default function InternalReportListPage() {
  return (
    <Suspense
      fallback={<div className="p-10 text-center">페이지 로딩 중...</div>}
    >
      <InternalReportContent />
    </Suspense>
  );
}
