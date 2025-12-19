"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Pagination from "@/components/pagination";

interface DailyReport {
  id: string;
  title: string;
  userName: string;
  createdAt: number;
  content?: string;
  fileUrl?: string | null;
  fileName?: string | null;
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

export default function Daily() {
  const { userName, role } = useSelector((state: RootState) => state.auth);

  // ✅ URL에서 현재 페이지 번호 가져오기 (없으면 1)
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const ITEMS_PER_PAGE = 15; // ✅ 15개씩 보기

  const { data, isLoading } = useQuery<DailyApiResponse>({
    queryKey: ["dailys", userName, page], // ✅ page가 바뀌면 쿼리키가 바뀌어 재요청됨
    queryFn: () =>
      fetchMyDailys(userName || "", role || "", page, ITEMS_PER_PAGE),
    enabled: !!userName,
  });

  // 데이터 안전하게 추출 (초기 로딩 시 undefined 방지)
  const dailyList = data?.list || [];
  const totalCount = data?.totalCount || 0;

  if (isLoading) return <div className="p-4 text-gray-500">로딩 중...</div>;

  return (
    <div className="flex flex-col w-full p-6">
      <div className="border rounded-2xl shadow-sm p-6 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xl font-semibold">일일 업무 보고서</h3>
          <Link
            href="/main/work/dailywrite"
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
          <ul>
            {dailyList.map((item) => (
              <li
                key={item.id}
                className="border-b border-gray-400  group hover:bg-gray-50 transition-colors"
              >
                <Link
                  href={`/main/work/daily/${item.id}`}
                  className="flex justify-between items-center w-full py-1"
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <span className="text-[#51709e] font-bold whitespace-nowrap">
                      [일일]
                    </span>
                    <p className="text-ms text-gray-800 truncate group-hover:text-[#51709e] transition-colors">
                      {item.title}
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
        )}
        <Pagination
          totalItems={totalCount}
          itemsPerPage={ITEMS_PER_PAGE}
          currentPage={page}
        />
      </div>
    </div>
  );
}
