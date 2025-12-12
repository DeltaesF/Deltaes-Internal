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
}

// 주간 보고서 1개 가져오기
const fetchWeeklyDetail = async (id: string) => {
  const res = await fetch(`/api/weekly/${id}`);
  if (!res.ok) throw new Error("Weekly fetch failed");
  return res.json();
};

// 일일 보고서 리스트 가져오기
const fetchDailyList = async (userName: string, role: string) => {
  const res = await fetch("/api/daily/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, role }),
  });
  if (!res.ok) throw new Error("Daily fetch failed");
  return res.json();
};

export default function WeeklyMeetingDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { userName: myName, role } = useSelector(
    (state: RootState) => state.auth || { userName: "", role: "" }
  );

  // 1. 주간 보고서 데이터
  const { data: weekly, isLoading: isWeeklyLoading } = useQuery<WeeklyReport>({
    queryKey: ["weeklyDetail", id],
    queryFn: () => fetchWeeklyDetail(id),
    enabled: !!id,
  });

  if (isWeeklyLoading)
    return <div className="p-8 text-center">보고서 불러오는 중...</div>;
  if (!weekly)
    return <div className="p-8 text-center">보고서를 찾을 수 없습니다.</div>;

  // ✅ [권한 체크] : 슈퍼바이저 이거나, 작성자 본인일 때만 내용을 보여줌
  const isAuthorized = role === "supervisor" || weekly.userName === myName;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-6 bg-white border rounded-2xl shadow-sm mx-auto max-w-2xl mt-10 p-10">
        <div className="text-6xl">🚫</div>
        <h2 className="text-2xl font-bold text-gray-800">
          접근 권한이 없습니다
        </h2>
        <p className="text-gray-500 text-center">
          다른 직원의 상세 업무 보고 내용은 열람할 수 없습니다.
          <br />
          본인의 보고서만 확인 가능합니다.
        </p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
        >
          뒤로가기
        </button>
      </div>
    );
  }

  // 권한이 있을 때만 내부 콘텐츠 렌더링
  return <AuthorizedContent weekly={weekly} myName={myName!} role={role!} />;
}

// ✅ 권한이 있는 경우 보여줄 실제 콘텐츠 컴포넌트
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

  // 일일 보고서 데이터 조회
  const { data: dailyList = [], isLoading: isDailyLoading } = useQuery<
    DailyReport[]
  >({
    queryKey: ["dailyListForMeeting", weekly.userName],
    queryFn: async () => {
      // 슈퍼바이저는 모든 데이터를 가져오므로 API 호출은 그대로 하고, 필터링은 클라이언트에서 수행
      const data = await fetchDailyList(myName, role);
      return data;
    },
  });

  // 📅 [수정됨] "스마트" 날짜 필터링 로직
  const weeklyDate = new Date(weekly.createdAt);
  const dayOfWeek = weeklyDate.getDay(); // 0(일) ~ 6(토)

  // 💡 작성일이 일(0), 월(1), 화(2)요일이라면 -> '지난주' 내용을 작성한 것으로 간주하여 기준일을 7일 전으로 돌림
  // 예: 12월 15일(월) 작성 -> 12월 8일(월)이 속한 주를 계산
  const targetDate = new Date(weeklyDate);
  if (dayOfWeek <= 2) {
    targetDate.setDate(targetDate.getDate() - 7);
  }

  // 기준일(targetDate)이 속한 주의 월요일 계산
  const targetDay = targetDate.getDay();
  const diffToMon =
    targetDate.getDate() - targetDay + (targetDay === 0 ? -6 : 1);

  const monday = new Date(targetDate);
  monday.setDate(diffToMon);
  monday.setHours(0, 0, 0, 0); // 월요일 00:00:00

  // 해당 주의 금요일 계산
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999); // 금요일 23:59:59

  const relatedDailys = dailyList
    .filter((daily) => {
      if (daily.userName !== weekly.userName) return false;
      const d = new Date(daily.createdAt);
      return d >= monday && d <= friday;
    })
    .sort((a, b) => a.createdAt - b.createdAt); // 작성순

  return (
    <div className="flex flex-col gap-8 p-6 max-w-5xl mx-auto pb-20">
      {/* 🔙 뒤로가기 & 타이틀 */}
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
              📑 주간 업무 보고
              <span className="text-sm font-normal opacity-80 bg-white/20 px-2 py-0.5 rounded">
                {weekly.userName}
              </span>
            </h2>
            <p className="text-white/90 text-sm mt-1">{weekly.title}</p>
          </div>

          {/* ✅ [추가됨] 주간 보고서 수정 버튼 */}
          {weekly.userName === myName && (
            <Link
              href={`/main/work/weekly/edit/${weekly.id}`}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium border border-white/30 transition-colors"
            >
              수정하기
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4 mt-4">
          <div className="h-[1px] flex-1 bg-gray-300"></div>
          <span className="text-gray-700 text-sm font-bold">
            관련 일일 업무 내역
          </span>
          <div className="h-[1px] flex-1 bg-gray-300"></div>
        </div>

        <section className="flex flex-col gap-6">
          {isDailyLoading ? (
            <p className="text-center text-gray-400 py-10">
              일일 업무 내역 로딩 중...
            </p>
          ) : relatedDailys.length > 0 ? (
            relatedDailys.map((daily, index) => (
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

                    {/* ✅ [추가됨] 작성자 본인일 경우 수정 버튼 표시 */}
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
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">
              해당 주간에 작성된 일일 업무 보고가 없습니다.
            </div>
          )}
        </section>

        <div className="flex items-center gap-4 mt-4">
          <div className="h-[1px] flex-1 bg-gray-300"></div>
          <span className="text-gray-700 text-sm font-bold">
            금주 업무 보고
          </span>
          <div className="h-[1px] flex-1 bg-gray-300"></div>
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
