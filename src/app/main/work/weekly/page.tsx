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
}

const fetchWeeklys = async (userName: string, role: string) => {
  const res = await fetch("/api/weekly/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, role }),
  });
  if (!res.ok) throw new Error("Failed to fetch data");
  return res.json();
};

export default function WeeklyMeetingListPage() {
  const { userName, role } = useSelector((state: RootState) => state.auth);

  const { data: weeklyList = [], isLoading } = useQuery<WeeklyReport[]>({
    queryKey: ["weeklys", "meeting", userName],
    queryFn: () => fetchWeeklys(userName || "", role || ""),
    enabled: !!userName,
  });

  if (isLoading) return <div className="p-6 text-gray-500">로딩 중...</div>;

  return (
    <div className="flex flex-col w-full p-6">
      <div className="border rounded-2xl shadow-sm p-6 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xl font-bold text-gray-800">주간 업무 회의</h3>
          <Link
            href="/main/work/weeklywrite"
            className="px-4 py-2 rounded-xl border border-[#519d9e] hover:bg-[#519d9e] hover:text-white cursor-pointer text-sm transition-colors"
          >
            글작성 ✎
          </Link>
        </div>

        {weeklyList.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            등록된 주간 업무 보고서가 없습니다.
          </div>
        ) : (
          <ul>
            {weeklyList.map((item) => (
              <li
                key={item.id}
                className="border-b border-gray-400  group hover:bg-gray-50 transition-colors"
              >
                <Link
                  href={`/main/work/weekly/${item.id}`}
                  className="flex justify-between items-center w-full py-1"
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <span className="text-[#519d9e] font-bold whitespace-nowrap">
                      [주간]
                    </span>
                    <p className="text-ms text-gray-800 truncate group-hover:text-[#519d9e] transition-colors">
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
      </div>
    </div>
  );
}
