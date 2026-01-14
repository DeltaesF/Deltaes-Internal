"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// 타입 정의
interface WeeklyReport {
  id: string;
  title: string;
  content: string;
  userName: string;
  createdAt: number;
  fileUrl?: string | null;
  fileName?: string | null;
}

interface DailyReport {
  id: string;
  title: string;
  content: string;
  userName: string;
  createdAt: number;
  // ✅ 첨부파일 필드 추가
  fileUrl?: string | null;
  fileName?: string | null;
}

// 주간 보고서 1개 가져오기
const fetchWeeklyDetail = async (id: string) => {
  const res = await fetch(`/api/weekly/${id}`);
  if (!res.ok) throw new Error("Weekly fetch failed");
  return res.json();
};

// ✅ [수정] 날짜 범위를 인자로 받도록 변경
const fetchDailyList = async (
  userName: string,
  role: string,
  startDate?: number,
  endDate?: number
) => {
  const res = await fetch("/api/daily/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName,
      role,
      page: 1,
      limit: 5, // ✅ 날짜 필터링을 하므로 100개까지 필요 없음 (보통 5~7개 나옴)
      startDate,
      endDate,
    }),
  });
  if (!res.ok) throw new Error("Daily fetch failed");

  const data = await res.json();
  return data.list || [];
};

export default function WeeklyDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { userName: myName, role } = useSelector(
    (state: RootState) => state.auth || { userName: "", role: "" }
  );

  const { data: weekly, isLoading: isWeeklyLoading } = useQuery<WeeklyReport>({
    queryKey: ["weeklyDetail", id],
    queryFn: () => fetchWeeklyDetail(id),
    enabled: !!id,
  });

  if (isWeeklyLoading)
    return <div className="p-8 text-center">보고서 불러오는 중...</div>;
  if (!weekly)
    return <div className="p-8 text-center">보고서를 찾을 수 없습니다.</div>;

  const isAuthorized =
    role === "supervisor" || role === "admin" || weekly.userName === myName;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-6 bg-white border rounded-2xl shadow-sm mx-auto max-w-2xl mt-10 p-10">
        <div className="text-6xl">🚫</div>
        <h2 className="text-2xl font-bold text-gray-800">
          접근 권한이 없습니다
        </h2>
        <button
          onClick={() => router.back()}
          className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
        >
          뒤로가기
        </button>
      </div>
    );
  }

  return <AuthorizedContent weekly={weekly} myName={myName!} role={role!} />;
}

function AuthorizedContent({
  weekly,
  myName,
  role,
}: {
  weekly: WeeklyReport;
  myName: string;
  role: string;
}) {
  const router = useRouter();

  // ✅ 1. useQuery 실행 전에 날짜 계산 로직을 먼저 수행
  const weeklyDate = new Date(weekly.createdAt);
  const dayOfWeek = weeklyDate.getDay();
  const targetDate = new Date(weeklyDate);

  // 주말(일, 월)에 작성했다면 지난주 데이터를 가져오도록 보정 (기존 로직 유지)
  if (dayOfWeek <= 2) {
    targetDate.setDate(targetDate.getDate() - 7);
  }

  const targetDay = targetDate.getDay();
  const diffToMon =
    targetDate.getDate() - targetDay + (targetDay === 0 ? -6 : 1);

  // 월요일 00:00:00
  const monday = new Date(targetDate);
  monday.setDate(diffToMon);
  monday.setHours(0, 0, 0, 0);

  // 금요일 23:59:59
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);

  // ✅ 2. 계산된 날짜를 API 호출 시 전달
  const { data: relatedDailys = [], isLoading: isDailyLoading } = useQuery<
    DailyReport[]
  >({
    queryKey: ["dailyListForMeeting", weekly.userName, monday.getTime()], // queryKey에 날짜 포함 추천
    queryFn: async () => {
      // startDate와 endDate(timestamp)를 함께 전달
      const data = await fetchDailyList(
        weekly.userName,
        role,
        monday.getTime(),
        friday.getTime()
      );
      return data;
    },
    // weekly 정보가 있을 때만 실행
    enabled: !!weekly.userName,
  });
  return (
    <div className="flex flex-col gap-8 p-6 max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors cursor-pointer"
        >
          ◀ 목록으로 돌아가기
        </button>
        <div className="text-sm text-gray-500">
          작성일: {new Date(weekly.createdAt).toLocaleString()}
        </div>
      </div>

      <section className="bg-white border-2 border-[#519d9e] rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-[#519d9e] px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {weekly.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 px-6">
          <div className="h-[1px] flex-1 bg-gray-300"></div>
          <span className="text-gray-700 text-sm font-bold">
            전주 일일 업무 내역
          </span>
          <div className="h-[1px] flex-1 bg-gray-300"></div>
        </div>

        <section className="flex flex-col gap-6 p-6">
          {isDailyLoading ? (
            <p className="text-center text-gray-400 py-10">
              일일 업무 내역 로딩 중...
            </p>
          ) : relatedDailys.length > 0 ? (
            relatedDailys.map((daily) => (
              <div
                key={daily.id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="bg-gray-50 px-6 py-3 border-b flex justify-between items-center rounded-t-xl">
                  <div className="flex items-center gap-3">
                    <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded">
                      {
                        ["일", "월", "화", "수", "목", "금", "토"][
                          new Date(daily.createdAt).getDay()
                        ]
                      }
                      요일
                    </span>
                    <h3 className="font-semibold text-gray-800">
                      {daily.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {new Date(daily.createdAt).toLocaleDateString()}
                    </span>
                    {daily.userName === myName && (
                      <Link
                        href={`/main/work/daily/edit/${daily.id}`}
                        className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                      >
                        수정
                      </Link>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  <div
                    className="prose-editor text-sm text-gray-700"
                    dangerouslySetInnerHTML={{ __html: daily.content }}
                  />
                  {/* ✅ [추가] 일일 업무 보고 첨부파일 표시 영역 */}
                  {daily.fileUrl && (
                    <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                      <a
                        href={daily.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
                      >
                        📎 {daily.fileName || "첨부파일 다운로드"}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">
              해당 주간에 작성된 일일 업무 보고가 없습니다.
            </div>
          )}
        </section>

        {/* ... (금주 업무 보고 영역 기존 유지) ... */}
        <div className="bg-[#519d9e] px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              금주 업무 보고
              <span className="text-sm font-normal opacity-90 bg-white/20 px-2 py-0.5 rounded">
                {weekly.userName}
              </span>
            </h2>
          </div>
          {weekly.userName === myName && (
            <Link
              href={`/main/work/weekly/edit/${weekly.id}`}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium border border-white/30 transition-colors"
            >
              수정하기
            </Link>
          )}
        </div>

        <div className="p-8">
          <div
            className="prose-editor max-w-none"
            dangerouslySetInnerHTML={{ __html: weekly.content }}
          />
          {weekly.fileUrl && (
            <div className="mt-8 pt-4 border-t">
              <p className="text-xs text-gray-500 font-bold mb-1">첨부파일</p>
              <a
                href={weekly.fileUrl}
                target="_blank"
                className="text-blue-600 hover:underline text-sm flex items-center gap-1"
              >
                📎 {weekly.fileName || "다운로드"}
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
