"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Pagination from "@/components/pagination";
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

const fetchReports = async (page: number) => {
  const res = await fetch("/api/report/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      page,
      limit: 15,
      reportType: "internal_edu", // ✅ 사내교육보고서 필터
    }),
  });
  return res.json();
};

function InternalReportContent() {
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const ITEMS_PER_PAGE = 15;

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ["reports", "internal", page],
    queryFn: () => fetchReports(page),
  });

  const list = data?.list || [];
  const totalCount = data?.totalCount || 0;

  if (isLoading) return <div className="p-10 text-center">로딩 중...</div>;

  return (
    <div className="flex flex-col w-full p-6">
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">사내 교육 보고서</h2>
          <Link
            href="/main/report/internal/write"
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
                  <td colSpan={6} className="py-10 text-center text-gray-400">
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
                      <Link
                        href={`/main/report/internal/${item.id}`}
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

        <Pagination
          totalItems={totalCount}
          itemsPerPage={ITEMS_PER_PAGE}
          currentPage={page}
        />
      </div>
    </div>
  );
}

export default function InternalReportListPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InternalReportContent />
    </Suspense>
  );
}
