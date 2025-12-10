"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Link from "next/link";

interface WeeklyReport {
  id: string;
  title: string;
  userName: string;
  createdAt: number;
  content?: string;
  fileUrl?: string | null;
  fileName?: string | null;
}

const fetchMyWeeklys = async (userName: string, role: string) => {
  const res = await fetch("/api/weekly/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, role }),
  });
  if (!res.ok) {
    throw new Error("Failed to fetch data");
  }
  return res.json();
};

export default function WeeklyPage() {
  const { userName, role } = useSelector((state: RootState) => state.auth);

  const { data: weeklyList = [], isLoading } = useQuery<WeeklyReport[]>({
    queryKey: ["weekly", userName], // 쿼리키에 userName 포함하여 캐시 분리
    queryFn: () => fetchMyWeeklys(userName || "", role || ""),
    enabled: !!userName, // 로그인이 되었을 때만 실행
  });

  if (isLoading) return <div className="p-4 text-gray-500">로딩 중...</div>;

  return (
    <div className="border rounded-2xl shadow-sm p-4 bg-white">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-[20px] font-semibold">주간 업무 보고서</h3>
        <Link
          href="/main/work/weeklywrite"
          className="px-4 py-2 rounded-xl border border-[#519d9e] hover:bg-[#519d9e] hover:text-white cursor-pointer text-sm transition-colors"
        >
          글작성 ✎
        </Link>
      </div>

      <ul>
        {weeklyList.map((item) => (
          <li
            key={item.id}
            className="border-b flex justify-between items-center hover:bg-gray-50 group transition-colors"
          >
            <Link
              href={`/main/work/weekly/${item.id}`}
              className="py-2 flex justify-between items-center w-full h-full px-2"
            >
              <p className="hover:text-purple-400 transition-colors truncate">
                {item.title}
              </p>
              <div className="flex items-center gap-[15px] text-xs text-gray-500 flex-shrink-0">
                <span className="font-medium text-gray-500">
                  {item.userName}
                </span>
                <span>
                  {new Date(item.createdAt).toLocaleDateString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </span>
              </div>
            </Link>
          </li>
        ))}

        {weeklyList.length === 0 && (
          <li className="py-4 text-center text-gray-400">
            등록된 주간 업무 보고서가 없습니다.
          </li>
        )}
      </ul>
    </div>
  );
}
