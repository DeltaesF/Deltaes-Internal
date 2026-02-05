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
      reportType: "external_edu", // ✅ 외부교육보고서 필터
    }),
  });
  if (!res.ok) throw new Error("Failed to fetch reports");
  return res.json();
};

function ExternalReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPage = Number(searchParams.get("page")) || 1;
  const ITEMS_PER_PAGE = 12; // ✅ 읽기 비용 최적화

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ["reports", "external", currentPage],
    queryFn: () => fetchReports(currentPage, ITEMS_PER_PAGE),
    placeholderData: (prev) => prev, // ✅ 로딩 중 이전 데이터 유지
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
    <div className="flex flex-col w-full p-6">
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-gray-800">외부 교육 보고서</h2>
          <Link
            href="/main/report/external/write"
            prefetch={false}
            className="px-4 py-2 bg-[#519d9e] text-white rounded-lg hover:bg-[#407f80] transition-colors font-bold text-sm"
          >
            보고서 작성 ✎
          </Link>
        </div>

        {/* 리스트 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                <th className="py-3 px-4 text-left">제목</th>
                <th className="py-3 px-4 text-center w-32">작성자</th>
                <th className="py-3 px-4 text-center w-32">작성일</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-gray-400">
                    등록된 보고서가 없습니다.
                  </td>
                </tr>
              ) : (
                list.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      {/* 통합 상세 페이지로 이동 */}
                      <Link
                        href={`/main/report/${item.id}`}
                        prefetch={false}
                        className="block w-full"
                      >
                        <span className="text-gray-800 hover:text-[#519d9e] font-medium transition-colors">
                          {item.title}
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-600">
                      {item.userName}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ✅ 페이지네이션 버튼 */}
        <div className="flex justify-center items-center gap-4 mt-6 py-2 border-t border-gray-100">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              currentPage === 1
                ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                : "bg-white text-gray-700 hover:bg-gray-50 hover:text-[#519d9e] border-gray-300"
            }`}
          >
            ◀ 이전
          </button>

          <span className="text-sm font-medium text-gray-600">
            Page <span className="text-[#519d9e] font-bold">{currentPage}</span>{" "}
            / {totalPages}
          </span>

          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              currentPage === totalPages
                ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                : "bg-white text-gray-700 hover:bg-gray-50 hover:text-[#519d9e] border-gray-300"
            }`}
          >
            다음 ▶
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExternalReportListPage() {
  return (
    <Suspense
      fallback={<div className="p-10 text-center">페이지 로딩 중...</div>}
    >
      <ExternalReportContent />
    </Suspense>
  );
}
