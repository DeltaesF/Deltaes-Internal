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

// 일일 보고서 리스트 가져오기 (비용 최적화 적용됨)
const fetchDailyList = async (
  userName: string,
  role: string,
  startDate: number,
  endDate: number
) => {
  const res = await fetch("/api/daily/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName,
      role,
      startDate,
      endDate,
      limit: 7, // ✅ 7개로 최적화
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
    return (
      <div className="p-10 text-center text-xl">보고서 불러오는 중...</div>
    );
  if (!weekly)
    return (
      <div className="p-10 text-center text-xl">보고서를 찾을 수 없습니다.</div>
    );

  const isAuthorized =
    role === "supervisor" || role === "admin" || weekly.userName === myName;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-6 bg-white border rounded-2xl shadow-sm mx-auto max-w-2xl mt-10 p-10">
        <div className="text-7xl">🚫</div>
        <h2 className="text-3xl font-bold text-gray-800">
          접근 권한이 없습니다
        </h2>
        <button
          onClick={() => router.back()}
          className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-bold text-lg"
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

  // 날짜 계산 로직
  const weeklyDate = new Date(weekly.createdAt);
  const dayOfWeek = weeklyDate.getDay();

  const targetDate = new Date(weeklyDate);
  if (dayOfWeek <= 2) {
    targetDate.setDate(targetDate.getDate() - 7);
  }
  const targetDay = targetDate.getDay();
  const diffToMon =
    targetDate.getDate() - targetDay + (targetDay === 0 ? -6 : 1);

  const monday = new Date(targetDate);
  monday.setDate(diffToMon);
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);

  const { data: dailyList = [], isLoading: isDailyLoading } = useQuery<
    DailyReport[]
  >({
    queryKey: ["dailyListForMeeting", weekly.userName, monday.getTime()],
    queryFn: async () => {
      const data = await fetchDailyList(
        weekly.userName,
        role,
        monday.getTime(),
        friday.getTime()
      );
      return data;
    },
  });

  const relatedDailys = dailyList.sort((a, b) => a.createdAt - b.createdAt);

  return (
    // ✅ [수정] max-w-5xl -> max-w-[80%] (화면 꽉 차게), p-6 -> p-4 (여백 축소)
    <div className="flex flex-col gap-6 p-4 max-w-[80%] mx-auto pb-20">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          // ✅ 버튼 크기 확대 (text-sm -> text-base, padding 증가)
          className="px-5 py-2.5 bg-white border rounded-lg hover:bg-gray-50 text-base font-medium transition-colors cursor-pointer"
        >
          ◀ 목록으로 돌아가기
        </button>
        {/* ✅ 날짜 폰트 확대 (text-sm -> text-lg) */}
        <div className="text-lg text-gray-600 font-medium">
          작성일: {new Date(weekly.createdAt).toLocaleString()}
        </div>
      </div>

      <section className="bg-white border-2 border-[#519d9e] rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-[#519d9e] px-8 py-5 flex justify-between items-center">
          <div>
            {/* ✅ 주간 보고서 제목 확대 (text-xl -> text-3xl) */}
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              {weekly.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-6 px-8">
          <div className="h-[2px] flex-1 bg-gray-300"></div>
          {/* ✅ 섹션 구분 텍스트 확대 (text-sm -> text-xl) */}
          <span className="text-gray-700 text-xl font-bold">
            전주 일일 업무 내역
          </span>
          <div className="h-[2px] flex-1 bg-gray-300"></div>
        </div>

        <section className="flex flex-col gap-6 p-8">
          {isDailyLoading ? (
            <p className="text-center text-gray-400 py-10 text-xl">
              일일 업무 내역 로딩 중...
            </p>
          ) : relatedDailys.length > 0 ? (
            relatedDailys.map((daily) => (
              <div
                key={daily.id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center rounded-t-xl">
                  <div className="flex items-center gap-4">
                    {/* ✅ 요일 뱃지 확대 (text-xs -> text-base) */}
                    <span className="bg-gray-200 text-gray-800 text-base font-bold px-3 py-1.5 rounded">
                      {
                        ["일", "월", "화", "수", "목", "금", "토"][
                          new Date(daily.createdAt).getDay()
                        ]
                      }
                      요일
                    </span>
                    {/* ✅ 일일 업무 제목 확대 (font-semibold -> text-xl font-bold) */}
                    <h3 className="text-xl font-bold text-gray-800">
                      {daily.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* ✅ 날짜 확대 (text-xs -> text-base) */}
                    <span className="text-base text-gray-600">
                      {new Date(daily.createdAt).toLocaleDateString()}
                    </span>
                    {daily.userName === myName && (
                      <Link
                        href={`/main/work/daily/edit/${daily.id}`}
                        className="text-sm px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700 transition-colors"
                      >
                        수정
                      </Link>
                    )}
                  </div>
                </div>

                <div className="p-8">
                  {/* ✅ 본문 글씨 확대 (text-sm -> text-lg, leading-relaxed 추가) */}
                  <div
                    className="prose-editor text-lg text-gray-800 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: daily.content }}
                  />
                  {daily.fileUrl && (
                    <div className="mt-6 pt-4 border-t border-dashed border-gray-200">
                      <a
                        href={daily.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        // ✅ 첨부파일 링크 확대 (text-xs -> text-base)
                        className="inline-flex items-center gap-2 text-base text-blue-700 hover:underline bg-blue-50 px-3 py-2 rounded font-medium"
                      >
                        📎 {daily.fileName || "첨부파일 다운로드"}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500 text-lg">
              해당 주간에 작성된 일일 업무 보고가 없습니다.
            </div>
          )}
        </section>

        <div className="bg-[#519d9e] px-8 py-5 flex justify-between items-center mt-4">
          <div>
            {/* ✅ 금주 업무 보고 제목 확대 (text-xl -> text-3xl) */}
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              금주 업무 보고
              <span className="text-lg font-normal opacity-90 bg-white/20 px-3 py-1 rounded">
                {weekly.userName}
              </span>
            </h2>
          </div>
          {weekly.userName === myName && (
            <Link
              href={`/main/work/weekly/edit/${weekly.id}`}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-base font-medium border border-white/30 transition-colors"
            >
              수정하기
            </Link>
          )}
        </div>

        <div className="p-10">
          {/* ✅ 본문 글씨 확대 (기본 -> text-xl, leading-loose) */}
          <div
            className="prose-editor max-w-none text-xl text-gray-900 leading-loose"
            dangerouslySetInnerHTML={{ __html: weekly.content }}
          />
          {weekly.fileUrl && (
            <div className="mt-10 pt-6 border-t">
              <p className="text-base text-gray-600 font-bold mb-2">첨부파일</p>
              <a
                href={weekly.fileUrl}
                target="_blank"
                // ✅ 첨부파일 링크 확대
                className="text-blue-700 hover:underline text-lg flex items-center gap-2 font-medium"
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
