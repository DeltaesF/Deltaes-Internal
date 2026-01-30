"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import koLocale from "@fullcalendar/core/locales/ko";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import eventsJson from "@/app/data/calendar.json";

// -----------------------------------------------------------------------
// [1] 타입 정의 (Strict Typing)
// -----------------------------------------------------------------------

type NotificationType = {
  id: string;
  fromUserName: string;
  type: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: number;
};

// 결재 대기 아이템 통합 타입 (approval 추가됨)
interface PendingItem {
  id: string;
  userName: string;
  status: string;
  createdAt: number;
  docType: "vacation" | "report" | "approval";
  // 휴가 전용
  startDate?: string;
  endDate?: string;
  daysUsed?: number;
  // 보고서/품의서 전용
  title?: string;
}

// 캘린더 관련 타입
interface CalendarItem {
  id: number;
  summary: string;
  start: { date: string };
  end: { date: string };
}

type EventType = {
  id?: string;
  title: string;
  start: string;
  end?: string;
  color?: string;
  display?: string;
  editable?: boolean;
};

type NewEventType = {
  docId: string;
  title: string;
  start: string;
  end: string;
};

// 컴포넌트 Props 타입
interface DashboardCardProps {
  title: string;
  count: number;
  color: "red" | "blue" | "green" | "purple";
  isActive: boolean;
  onClick: () => void;
}

interface ListModalLayoutProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  moreLink?: string;
}

interface NotificationItemProps {
  noti: NotificationType;
  onClose: () => void;
}

interface CompletedItem {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  title?: string; // 문서 제목
  category?: string;
  reason?: string; // 휴가 사유
  implementDate?: string; // 시행일
}

// -----------------------------------------------------------------------
// 헬퍼 함수
// -----------------------------------------------------------------------
function addOneDay(dateStr: string) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

function isToday(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

// 카드 내용 렌더링 헬퍼
const getCardContent = (item: PendingItem) => {
  if (item.docType === "report" || item.docType === "approval") {
    return (
      <p className="text-sm text-gray-800 font-medium truncate">
        📄 {item.title || "제목 없음"}
      </p>
    );
  }
  return (
    <p className="text-sm text-gray-600">
      🏖️ {item.startDate} ~ {item.endDate} ({item.daysUsed}일)
    </p>
  );
};

// -----------------------------------------------------------------------
// [2] API 호출 함수
// -----------------------------------------------------------------------

const fetchNotifications = async (userName: string) => {
  const res = await fetch("/api/notifications/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName }),
  });
  const data = await res.json();
  return (data.list as NotificationType[]) || [];
};

// ✅ 통합 결재 대기 목록 (휴가 + 보고서 + 품의서)
const fetchCombinedPending = async (
  userName: string
): Promise<PendingItem[]> => {
  // 1. 휴가 대기 목록
  const fetchVacations = fetch("/api/vacation/pending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approverName: userName }),
  }).then(async (res) => {
    const data = await res.json();
    return (data.pending || []).map((v: Omit<PendingItem, "docType">) => ({
      ...v,
      docType: "vacation",
    }));
  });

  // 2. 보고서 대기 목록
  const fetchReports = fetch("/api/report/pending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approverName: userName }),
  }).then(async (res) => {
    const data = await res.json();
    return (data.pending || []).map((r: Omit<PendingItem, "docType">) => ({
      ...r,
      docType: "report",
    }));
  });

  // 3. 품의서 대기 목록 추가
  const fetchApprovals = fetch("/api/approvals/pending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approverName: userName }),
  }).then(async (res) => {
    const data = await res.json();
    return (data.pending || []).map((a: Omit<PendingItem, "docType">) => ({
      ...a,
      docType: "approval",
    }));
  });

  // 병렬 실행 후 합치기
  const [vacations, reports, approvals] = await Promise.all([
    fetchVacations,
    fetchReports,
    fetchApprovals,
  ]);

  const combined: PendingItem[] = [...vacations, ...reports, ...approvals];
  combined.sort((a, b) => b.createdAt - a.createdAt); // 최신순 정렬

  return combined;
};

// 결재 완료 목록
const fetchCompletedHistory = async (userName: string) => {
  const res = await fetch("/api/vacation/approve-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName }),
  });
  const data = await res.json();
  return (data.list as CompletedItem[]) || [];
};

// 캘린더
const fetchEvents = async (userDocId: string) => {
  const res = await fetch(
    `/api/today/list?docId=${encodeURIComponent(userDocId)}`
  );
  return res.json();
};

// -----------------------------------------------------------------------
// [3] 컴포넌트 시작
// -----------------------------------------------------------------------
export default function Individual() {
  const { userDocId, userName, role, loginTime } = useSelector(
    (state: RootState) =>
      state.auth || {
        userDocId: null,
        userName: "사용자",
        role: null,
        loginTime: null,
      }
  );
  const router = useRouter();
  const queryClient = useQueryClient();

  const [modalType, setModalType] = useState<string | null>(null);

  // =====================================================================
  // Data Fetching
  // =====================================================================

  const { data: notifications = [] } = useQuery<NotificationType[]>({
    queryKey: ["notifications", userName],
    queryFn: () => fetchNotifications(userName!),
    enabled: !!userName,
  });

  const { data: approvalRequests = [] } = useQuery<PendingItem[]>({
    queryKey: ["combinedPending", userName],
    queryFn: () => fetchCombinedPending(userName!),
    enabled: !!userName,
  });

  const { data: completedList = [] } = useQuery<CompletedItem[]>({
    queryKey: ["completedHistory", userName],
    queryFn: () => fetchCompletedHistory(userName!),
    enabled: !!userName,
  });

  const { data: myEvents = [] } = useQuery<EventType[]>({
    queryKey: ["events", userDocId],
    queryFn: () => fetchEvents(userDocId!),
    enabled: !!userDocId,
  });

  const trainingEvents: EventType[] = (eventsJson.items || []).map(
    (item: CalendarItem) => ({
      id: `training-${item.id}`,
      title: item.summary,
      start: item.start.date,
      end: item.end ? addOneDay(item.end.date) : undefined,
      color: "#A3A3A3",
      display: "block",
      editable: false,
    })
  );

  const allEvents = [...myEvents, ...trainingEvents];

  // =====================================================================
  // Data Filtering
  // =====================================================================

  const workReports = notifications.filter(
    (n) => (n.type === "daily" || n.type === "weekly") && isToday(n.createdAt)
  );

  const sharedContents = notifications.filter((n) =>
    ["report", "approval", "notice", "resource", "vacation_complete"].includes(
      n.type
    )
  );

  // =====================================================================
  // Mutations
  // =====================================================================

  const addEventMutation = useMutation({
    mutationFn: async (newEvent: NewEventType) => {
      const res = await fetch("/api/today/add", {
        method: "POST",
        body: JSON.stringify(newEvent),
      });
      if (!res.ok) throw new Error("추가 실패");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch("/api/today/delete", {
        method: "POST",
        body: JSON.stringify({ docId: userDocId, eventId }),
      });
      if (!res.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const handleDateClick = (arg: DateClickArg) => {
    if (!userDocId) return alert("로그인 필요");
    const title = prompt("일정을 입력하세요:");
    if (!title) return;
    const startInput = prompt("시작일 (YYYY-MM-DD)", arg.dateStr);
    if (!startInput) return;
    const endInput = prompt("종료일 (YYYY-MM-DD)", startInput);
    if (!endInput) return;

    const endDate = new Date(endInput);
    endDate.setDate(endDate.getDate() + 1);

    addEventMutation.mutate({
      docId: userDocId,
      title,
      start: startInput,
      end: endDate.toISOString().split("T")[0],
    });
  };

  // =====================================================================
  // Render
  // =====================================================================

  return (
    <div className="flex flex-col gap-6 md:gap-10 mt-2 md:mt-6 items-center w-full">
      {/* 로그인 시간 표시 UI */}
      {/* [반응형 수정] max-w-[1200px] -> max-w-7xl, justify-end -> justify-center md:justify-end */}
      <div className="w-full max-w-7xl flex justify-center md:justify-end">
        <div className="text-xs md:text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full shadow-sm">
          🕒 접속 시간:{" "}
          <span className="font-semibold text-gray-700">
            {loginTime || "-"}
          </span>
        </div>
      </div>

      {/* 4개의 카드 그리드 */}
      {/* [반응형 수정] grid-cols-4 -> grid-cols-2 lg:grid-cols-4 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full max-w-7xl">
        <DashboardCard
          title="결재 요청"
          count={approvalRequests.length}
          color="red"
          isActive={modalType === "pending"}
          onClick={() => setModalType("pending")}
        />
        <DashboardCard
          title="업무 보고"
          count={workReports.length}
          color="blue"
          isActive={modalType === "work"}
          onClick={() => setModalType("work")}
        />
        <DashboardCard
          title="결재 완료"
          count={completedList.length}
          color="green"
          isActive={modalType === "completed"}
          onClick={() => setModalType("completed")}
        />
        <DashboardCard
          title="공유 내용"
          count={sharedContents.length}
          color="purple"
          isActive={modalType === "shared"}
          onClick={() => setModalType("shared")}
        />
      </div>

      {/* 캘린더 영역 */}
      {/* [반응형 수정] w-[1200px] -> w-full max-w-7xl */}
      <div className="bg-white shadow-md border rounded-2xl p-4 md:p-6 w-full max-w-7xl">
        <h2 className="text-base md:text-lg font-semibold mb-4">
          📅 {userName}님의 일정
        </h2>
        {/* [반응형 수정] 높이 조정 (모바일은 조금 더 작게) */}
        <div className="h-[500px] md:h-[600px]">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="100%"
            locale={koLocale}
            events={allEvents}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek,dayGridDay",
            }}
            dateClick={handleDateClick}
            eventClick={(info) => {
              if (info.event.id.startsWith("training-")) return;
              if (confirm(`'${info.event.title}' 일정을 삭제하시겠습니까?`)) {
                deleteEventMutation.mutate(info.event.id);
              }
            }}
          />
        </div>
      </div>

      {/* ======================= 모달 영역 ======================= */}

      {/* 1. 결재 요청 모달 */}
      {modalType === "pending" && (
        <ListModalLayout
          title="결재 요청 목록 (최신 5건)"
          onClose={() => setModalType(null)}
          moreLink="/main/my-approval/pending"
        >
          {approvalRequests.length > 0 ? (
            approvalRequests.slice(0, 5).map((v) => {
              const canApprove = role !== "user" && v.userName !== userName;

              return (
                <div
                  key={v.id}
                  onClick={() => router.push("/main/my-approval/pending")}
                  className="bg-white p-3 border rounded-lg hover:bg-red-50 hover:border-red-200 transition-all cursor-pointer flex justify-between items-center group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded">
                        {v.status}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {v.userName}
                      </span>
                      {/* 문서 종류 뱃지 */}
                      <span className="text-xs text-gray-500 border px-1.5 py-0.5 rounded bg-gray-100 font-medium">
                        {v.docType === "report"
                          ? "보고서"
                          : v.docType === "approval"
                          ? "품의서"
                          : "휴가"}
                      </span>
                    </div>
                    {/* 내용 표시 (헬퍼 함수 사용) */}
                    {getCardContent(v)}
                  </div>
                  {canApprove && (
                    <span className="text-xs text-red-400 font-medium group-hover:text-red-600 whitespace-nowrap ml-2">
                      결재하기 →
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <EmptyState message="대기 중인 결재 요청이 없습니다." />
          )}
          {approvalRequests.length > 5 && (
            <p className="text-center text-xs text-gray-400 mt-2">
              ...외 {approvalRequests.length - 5}건이 더 있습니다.
            </p>
          )}
        </ListModalLayout>
      )}

      {/* 2. 업무 보고 모달 */}
      {modalType === "work" && (
        <ListModalLayout
          title="금일 업무 보고"
          onClose={() => setModalType(null)}
          moreLink="/main/my-approval/shared"
        >
          {workReports.length > 0 ? (
            workReports.map((noti) => (
              <NotificationItem
                key={noti.id}
                noti={noti}
                onClose={() => setModalType(null)}
              />
            ))
          ) : (
            <EmptyState message="오늘 작성된 업무 보고가 없습니다." />
          )}
        </ListModalLayout>
      )}

      {/* 3. 결재 완료 모달 */}
      {modalType === "completed" && (
        <ListModalLayout
          title="결재 완료 내역 (최신 5건)"
          onClose={() => setModalType(null)}
          moreLink="/main/my-approval/completed"
        >
          {completedList.length > 0 ? (
            completedList.slice(0, 5).map((v) => (
              <div
                key={v.id}
                onClick={() => router.push("/main/my-approval/completed")}
                className="bg-gray-50 p-3 border rounded-lg hover:bg-green-50 hover:border-green-200 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">
                        승인완료
                      </span>
                      <span className="font-semibold text-gray-700">
                        {v.userName}
                      </span>
                    </div>
                    {v.category === "vacation" ? (
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <span>
                          {v.startDate} ~ {v.endDate}
                        </span>
                        {v.reason && (
                          <span className="text-black text-xs truncate max-w-[250px]">
                            📝 {v.reason}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        {v.implementDate && <span>{v.implementDate}</span>}
                        <span className="text-black text-xs truncate max-w-[250px] font-medium">
                          {v.title || "제목 없음"}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-green-400 font-medium group-hover:text-green-600 opacity-0 group-hover:opacity-100">
                    상세보기 →
                  </span>
                </div>
              </div>
            ))
          ) : (
            <EmptyState message="완료된 결재 내역이 없습니다." />
          )}
        </ListModalLayout>
      )}

      {/* 4. 공유 내용 모달 */}
      {modalType === "shared" && (
        <ListModalLayout
          title="공유 내용 (최신 5건)"
          onClose={() => setModalType(null)}
          moreLink="/main/my-approval/shared"
        >
          {sharedContents.length > 0 ? (
            sharedContents
              .slice(0, 5)
              .map((noti) => (
                <NotificationItem
                  key={noti.id}
                  noti={noti}
                  onClose={() => setModalType(null)}
                />
              ))
          ) : (
            <EmptyState message="공유된 내용이 없습니다." />
          )}
        </ListModalLayout>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// [4] 하위 컴포넌트들 (Strict Props)
// -----------------------------------------------------------------------

function DashboardCard({
  title,
  count,
  color,
  isActive,
  onClick,
}: DashboardCardProps) {
  const colorStyles: Record<
    string,
    { bg: string; border: string; text: string; num: string }
  > = {
    red: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-600",
      num: "text-red-500",
    },
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-600",
      num: "text-blue-500",
    },
    green: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-600",
      num: "text-green-500",
    },
    purple: {
      bg: "bg-purple-50",
      border: "border-purple-200",
      text: "text-purple-600",
      num: "text-purple-500",
    },
  };
  const style = colorStyles[color] || colorStyles.red;

  return (
    <div
      onClick={onClick}
      className={`shadow-sm border rounded-2xl p-4 md:p-6 text-center cursor-pointer transition-all group ${
        isActive
          ? `${style.bg} ${style.border} ring-2`
          : "bg-white hover:bg-gray-50"
      }`}
    >
      <span
        className={`font-semibold block mb-2 text-sm md:text-base ${
          isActive ? style.text : "text-gray-600"
        }`}
      >
        {title}
      </span>
      <span className={`text-3xl md:text-4xl font-bold ${style.num}`}>
        {count}
      </span>
      <span className="text-gray-400 text-xs md:text-sm ml-1">건</span>
    </div>
  );
}

function ListModalLayout({
  title,
  onClose,
  children,
  moreLink,
}: ListModalLayoutProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
      {/* [반응형 수정] w-[600px] -> w-full max-w-[600px] */}
      <div className="bg-white rounded-xl p-6 w-full max-w-[600px] max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-lg md:text-xl font-bold text-gray-800">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black text-2xl font-light cursor-pointer"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1 pr-1 space-y-3">{children}</div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 py-3 rounded-lg hover:bg-gray-300 font-medium text-gray-600"
          >
            닫기
          </button>
          {moreLink && (
            <Link
              href={moreLink}
              className="flex-1 bg-[#519d9e] flex items-center justify-center py-3 rounded-lg hover:bg-[#407f80] font-medium text-white"
            >
              전체 보기 →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-gray-400 bg-gray-50 rounded-lg border border-dashed text-sm">
      <p>{message}</p>
    </div>
  );
}

function NotificationItem({ noti, onClose }: NotificationItemProps) {
  const typeLabel: Record<string, string> = {
    daily: "일일",
    weekly: "주간",
    report: "보고서",
    approval: "품의",
    notice: "공지",
    resource: "자료",
    vacation: "휴가",
    vacation_request: "결재요청",
    vacation_complete: "휴가승인",
  };
  const colorClass: Record<string, string> = {
    daily: "bg-blue-100 text-blue-700",
    weekly: "bg-indigo-100 text-indigo-700",
    report: "bg-purple-100 text-purple-700",
    approval: "bg-pink-100 text-pink-700",
    notice: "bg-orange-100 text-orange-700",
    resource: "bg-gray-200 text-gray-700",
    vacation: "bg-green-100 text-green-700",
    vacation_request: "bg-red-100 text-red-700",
    vacation_complete: "bg-green-100 text-green-700",
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")} ${String(
      date.getHours()
    ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <Link href={noti.link} onClick={onClose} className="block group">
      <div className="bg-white p-4 border rounded-lg group-hover:border-blue-300 group-hover:shadow-md transition-all">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                colorClass[noti.type] || "bg-gray-100"
              }`}
            >
              {typeLabel[noti.type] || noti.type}
            </span>
            <span className="text-xs text-gray-400">
              {formatDate(noti.createdAt)}
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-800 font-medium leading-relaxed">
          {noti.message}
        </p>
        <div className="mt-2 text-xs text-blue-500 font-semibold text-right opacity-0 group-hover:opacity-100 transition-opacity">
          바로가기 →
        </div>
      </div>
    </Link>
  );
}
