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
// [1] 타입 정의
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

type VacationType = {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  daysUsed: number;
  approvers: { first?: string[]; second?: string[]; shared?: string[] };
};

type EventType = { id?: string; title: string; start: string; end?: string };
type NewEventType = {
  docId: string;
  title: string;
  start: string;
  end: string;
};

interface CalendarItem {
  id: number;
  summary: string;
  start: { date: string };
  end: { date: string };
}

// -----------------------------------------------------------------------
// 헬퍼 함수
// -----------------------------------------------------------------------
function addOneDay(dateStr: string) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

// ✅ [추가] 오늘 날짜인지 확인하는 함수
function isToday(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

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
  return data.list || [];
};

// 결재 대기 목록
const fetchPendingVacations = async (userName: string) => {
  const res = await fetch("/api/vacation/pending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approverName: userName }),
  });
  const data = await res.json();
  return data.pending || [];
};

// 결재 완료 목록
const fetchCompletedHistory = async (userName: string) => {
  const res = await fetch("/api/vacation/approve-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName }),
  });
  const data = await res.json();
  return data.list || [];
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
  // ✅ [수정] role 추가 (권한 확인용), loginTime 추가로 가져오기
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
    refetchInterval: 30000,
  });

  const { data: pendingVacations = [] } = useQuery<VacationType[]>({
    queryKey: ["pendingVacations", userName],
    queryFn: () => fetchPendingVacations(userName!),
    enabled: !!userName,
  });

  const { data: completedList = [] } = useQuery<VacationType[]>({
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

  // ✅ [수정] 업무 보고: 오늘 날짜인 것만 필터링
  const workReports = notifications.filter(
    (n) => (n.type === "daily" || n.type === "weekly") && isToday(n.createdAt)
  );

  const sharedContents = notifications.filter((n) =>
    ["report", "approval", "notice", "resource", "vacation_complete"].includes(
      n.type
    )
  );

  const approvalRequests = pendingVacations;
  const completedHistory = completedList;

  // =====================================================================
  // Mutations (캘린더용)
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
    <div className="flex flex-col gap-10 mt-6 items-center w-full">
      {/* ✅ [추가] 로그인 시간 표시 UI */}
      <div className="w-full max-w-[1200px] flex justify-end">
        <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full shadow-sm">
          🕒 접속 시간:{" "}
          <span className="font-semibold text-gray-700">
            {loginTime || "-"}
          </span>
        </div>
      </div>
      {/* 4개의 카드 그리드 */}
      <div className="grid grid-cols-4 gap-6 w-full max-w-[1200px]">
        {/* 1. 결재 요청 */}
        <div
          onClick={() => setModalType("pending")}
          className={`shadow-sm border rounded-2xl p-6 text-center cursor-pointer transition-all group ${
            modalType === "pending"
              ? "bg-red-50 border-red-200 ring-2 ring-red-200"
              : "bg-white hover:bg-red-50 hover:border-red-200"
          }`}
        >
          <span
            className={`font-semibold block mb-2 ${
              modalType === "pending" ? "text-red-600" : "text-gray-600"
            }`}
          >
            결재 요청
          </span>
          <span className="text-4xl font-bold text-red-500">
            {approvalRequests.length}
          </span>
          <span className="text-gray-400 text-sm ml-1">건</span>
        </div>

        {/* 2. 업무 보고 */}
        <div
          onClick={() => setModalType("work")}
          className={`shadow-sm border rounded-2xl p-6 text-center cursor-pointer transition-all group ${
            modalType === "work"
              ? "bg-blue-50 border-blue-200 ring-2 ring-blue-200"
              : "bg-white hover:bg-blue-50 hover:border-blue-200"
          }`}
        >
          <span
            className={`font-semibold block mb-2 ${
              modalType === "work" ? "text-blue-600" : "text-gray-600"
            }`}
          >
            업무 보고
          </span>
          <span className="text-4xl font-bold text-blue-500">
            {workReports.length}
          </span>
          <span className="text-gray-400 text-sm ml-1">건</span>
        </div>

        {/* 3. 결재 완료 */}
        <div
          onClick={() => setModalType("completed")}
          className={`shadow-sm border rounded-2xl p-6 text-center cursor-pointer transition-all group ${
            modalType === "completed"
              ? "bg-green-50 border-green-200 ring-2 ring-green-200"
              : "bg-white hover:bg-green-50 hover:border-green-200"
          }`}
        >
          <span
            className={`font-semibold block mb-2 ${
              modalType === "completed" ? "text-green-600" : "text-gray-600"
            }`}
          >
            결재 완료
          </span>
          <span className="text-4xl font-bold text-green-500">
            {completedHistory.length}
          </span>
          <span className="text-gray-400 text-sm ml-1">건</span>
        </div>

        {/* 4. 공유 내용 */}
        <div
          onClick={() => setModalType("shared")}
          className={`shadow-sm border rounded-2xl p-6 text-center cursor-pointer transition-all group ${
            modalType === "shared"
              ? "bg-purple-50 border-purple-200 ring-2 ring-purple-200"
              : "bg-white hover:bg-purple-50 hover:border-purple-200"
          }`}
        >
          <span
            className={`font-semibold block mb-2 ${
              modalType === "shared" ? "text-purple-600" : "text-gray-600"
            }`}
          >
            공유 내용
          </span>
          <span className="text-4xl font-bold text-purple-500">
            {sharedContents.length}
          </span>
          <span className="text-gray-400 text-sm ml-1">건</span>
        </div>
      </div>

      {/* 캘린더 영역 */}
      <div className="bg-white shadow-md border rounded-2xl p-6 w-full max-w-[1200px]">
        <h2 className="text-lg font-semibold mb-4">📅 {userName}님의 일정</h2>
        <div className="h-[600px]">
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

      {/* 1. 결재 요청 모달 (간략 보기 -> 클릭 시 페이지 이동) */}
      {modalType === "pending" && (
        <ListModalLayout
          title="결재 요청 목록 (최신 5건)"
          onClose={() => setModalType(null)}
          moreLink="/main/my-approval/pending"
        >
          {approvalRequests.length > 0 ? (
            approvalRequests.slice(0, 5).map((v) => {
              // ✅ [수정] 결재 권한이 있고(user 아님), 타인의 신청 건인 경우에만 버튼 표시
              const canApprove = role !== "user" && v.userName !== userName;

              return (
                <div
                  key={v.id}
                  onClick={() => router.push("/main/my-approval/pending")}
                  className="bg-white p-3 border rounded-lg hover:bg-red-50 hover:border-red-200 transition-all cursor-pointer flex justify-between items-center group"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded">
                        {v.status}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {v.userName}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {v.startDate} ~ {v.endDate} ({v.daysUsed}일)
                    </p>
                  </div>
                  {/* ✅ 조건부 렌더링: user거나 본인 글이면 아무것도 안 보임 */}
                  {canApprove && (
                    <span className="text-xs text-red-400 font-medium group-hover:text-red-600">
                      결재하러 가기 →
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

      {/* 2. 업무 보고 모달 (오늘 내역 전체 보기) */}
      {modalType === "work" && (
        <ListModalLayout
          title="금일 업무 보고" // 제목 변경
          onClose={() => setModalType(null)}
          moreLink="/main/my-approval/shared"
        >
          {workReports.length > 0 ? (
            // ✅ [수정] slice 제거 -> 오늘 내역은 다 보여줌 (스크롤)
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
          {completedHistory.length > 0 ? (
            completedHistory.slice(0, 5).map((v) => (
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
                    <p className="text-sm text-gray-600">
                      {v.startDate} ~ {v.endDate}
                    </p>
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

// ... (하위 컴포넌트는 기존과 동일) ...
function ListModalLayout({
  title,
  onClose,
  children,
  moreLink,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  moreLink?: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl p-6 w-[600px] max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
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
            className="flex-1 bg-gray-200 py-3 rounded-lg hover:bg-gray-300 font-medium text-gray-600 transition-colors cursor-pointer"
          >
            닫기
          </button>

          {moreLink && (
            <Link
              href={moreLink}
              className="flex-1 bg-[#519d9e] flex items-center justify-center py-3 rounded-lg hover:bg-[#407f80] font-medium text-white transition-colors cursor-pointer"
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
    <div className="flex flex-col items-center justify-center h-40 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
      <p>{message}</p>
    </div>
  );
}

function NotificationItem({
  noti,
  onClose,
}: {
  noti: NotificationType;
  onClose: () => void;
}) {
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
  };

  return (
    <Link href={noti.link} onClick={onClose} className="block group">
      <div className="bg-white p-4 border rounded-lg group-hover:border-blue-300 group-hover:shadow-md transition-all">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
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
