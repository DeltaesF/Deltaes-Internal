"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
}

export default function Pagination({
  totalItems,
  itemsPerPage,
  currentPage,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // 페이지가 1개뿐이면 숨김
  if (totalPages <= 1) return null;

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex justify-center gap-2 mt-6">
      <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-white"
      >
        &lt;
      </button>

      {/* 간단하게 1~5페이지 범위만 보여주거나 전체 보여주기 (여기선 전체 예시) */}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => handlePageChange(p)}
          className={`px-3 py-1 border rounded transition-colors ${
            p === currentPage
              ? "bg-[#519d9e] text-white border-[#519d9e]"
              : "hover:bg-gray-100"
          }`}
        >
          {p}
        </button>
      ))}

      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-white"
      >
        &gt;
      </button>
    </div>
  );
}
