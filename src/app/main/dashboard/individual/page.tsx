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
  approvers: { first?: string[]; second?: string[] };
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
// 날짜 문자열 "YYYY-MM-DD"를 받아 하루를 더하는 함수 (FullCalendar end 날짜 보정용)
function addOneDay(dateStr: string) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

// -----------------------------------------------------------------------
// [2] API 호출 함수 (Fetchers)
// -----------------------------------------------------------------------

// 🔔 통합 알림 조회 (업무보고 & 공유내용 용도)
const fetchNotifications = async (userName: string) => {
  const res = await fetch("/api/notifications/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName }),
  });
  const data = await res.json();
  return data.list || [];
};

// ✍️ 결재 대기 목록 조회 (내가 결재해야 할 건)
const fetchPendingVacations = async (
  userDocId: string,
  role: string | null
) => {
  // role을 보내서 서버에서 1차/2차 결재자 여부를 판단하게 함 (admin/ceo 등)
  const res = await fetch("/api/vacation/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: userDocId, role }),
  });
  const data = await res.json();
  return data.list || [];
};

// ✅ 결재 완료 목록 조회 (내가 승인한 건 - 전체 날짜)
const fetchCompletedHistory = async (userName: string) => {
  const res = await fetch("/api/vacation/approve-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName }),
  });
  const data = await res.json();
  return data.list || [];
};

// 📅 캘린더 일정 조회
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
  const { userDocId, userName, role } = useSelector(
    (state: RootState) =>
      state.auth || { userDocId: null, userName: "사용자", role: null }
  );
  const queryClient = useQueryClient();

  // 모달 상태 관리 ('pending' | 'work' | 'completed' | 'shared' | null)
  const [modalType, setModalType] = useState<string | null>(null);

  // 승인용 선택 상태
  const [selectedVacationForApprove, setSelectedVacationForApprove] =
    useState<VacationType | null>(null);

  // =====================================================================
  // Data Fetching (React Query)
  // =====================================================================

  // 1. 알림 데이터 (업무보고 + 공유내용)
  const { data: notifications = [] } = useQuery<NotificationType[]>({
    queryKey: ["notifications", userName],
    queryFn: () => fetchNotifications(userName!),
    enabled: !!userName,
    refetchInterval: 30000, // 30초마다 갱신
  });

  // 2. 결재 요청 데이터 (휴가 등)
  const { data: pendingVacations = [] } = useQuery<VacationType[]>({
    queryKey: ["pendingVacations", userDocId],
    queryFn: () => fetchPendingVacations(userDocId!, role),
    enabled:
      !!userDocId &&
      (role === "admin" || role === "ceo" || role === "supervisor"),
  });

  // 3. 결재 완료 데이터
  const { data: completedList = [] } = useQuery<VacationType[]>({
    queryKey: ["completedHistory", userName],
    queryFn: () => fetchCompletedHistory(userName!),
    enabled: !!userName,
  });

  // 4. 캘린더 데이터 및 개인 일정 - 개인 일정
  const { data: myEvents = [] } = useQuery<EventType[]>({
    queryKey: ["events", userDocId],
    queryFn: () => fetchEvents(userDocId!),
    enabled: !!userDocId,
  });

  // 교육 일정
  const trainingEvents: EventType[] = (eventsJson.items || []).map(
    (item: CalendarItem) => ({
      id: `training-${item.id}`, // ID 충돌 방지를 위해 접두사 추가
      title: item.summary,
      start: item.start.date,
      end: item.end ? addOneDay(item.end.date) : undefined,
      color: "#A3A3A3", // (선택) 교육 일정은 회색으로 구분
      display: "block",
      editable: false, // (선택) 드래그 수정 불가
    })
  );

  // ✅ [병합] 개인 일정 + 교육 일정
  const allEvents = [...myEvents, ...trainingEvents];

  // =====================================================================
  // Data Filtering (데이터 분류)
  // =====================================================================

  // [Card 2] 업무 보고 (일일/주간) - 알림에서 필터링
  const workReports = notifications.filter(
    (n) => n.type === "daily" || n.type === "weekly"
  );

  // [Card 4] 공유 내용 (그 외 나머지) - 알림에서 필터링
  const sharedContents = notifications.filter((n) =>
    ["report", "approval", "notice", "resource"].includes(n.type)
  );

  // [Card 1] 결재 요청 (현재는 휴가만)
  const approvalRequests = pendingVacations;

  // [Card 3] 결재 완료 (현재는 휴가만)
  const completedHistory = completedList;

  // =====================================================================
  // Mutations (승인, 일정 추가/삭제)
  // =====================================================================

  // 휴가 승인
  const approveMutation = useMutation({
    mutationFn: async ({
      id,
      applicant,
    }: {
      id: string;
      applicant: string;
    }) => {
      const res = await fetch("/api/vacation/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacationId: id,
          approverName: userDocId,
          applicantUserName: applicant,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "승인 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      alert("승인되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["pendingVacations"] });
      queryClient.invalidateQueries({ queryKey: ["completedHistory"] });
      setSelectedVacationForApprove(null);
      setModalType(null);
    },
    onError: (err) => alert(err.message),
  });

  // 일정 추가
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

  // 일정 삭제
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

  // =====================================================================
  // Event Handlers
  // =====================================================================

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

  const handleApproveClick = (item: VacationType) => {
    setSelectedVacationForApprove(item);
  };

  const confirmApprove = () => {
    if (selectedVacationForApprove) {
      if (confirm("정말 승인하시겠습니까?")) {
        approveMutation.mutate({
          id: selectedVacationForApprove.id,
          applicant: selectedVacationForApprove.userName,
        });
      }
    }
  };

  // =====================================================================
  // Render
  // =====================================================================

  return (
    <div className="flex flex-col gap-10 mt-6 items-center w-full">
      {/* 4개의 카드 그리드 */}
      <div className="grid grid-cols-4 gap-6 w-full max-w-[1200px]">
        {/* 1. 결재 요청 */}
        <div
          onClick={() => setModalType("pending")}
          className={`shadow-sm border rounded-2xl p-6 text-center cursor-pointer transition-all group ${
            modalType === "pending"
              ? "bg-red-50 border-red-200 ring-2 ring-red-200" // 선택됨 (모달 열림)
              : "bg-white hover:bg-red-50 hover:border-red-200" // 기본
          }`}
        >
          <span
            className={`font-semibold block mb-2 group-hover:text-red-600 ${
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
            className={`font-semibold block mb-2 group-hover:text-blue-600 ${
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
            className={`font-semibold block mb-2 group-hover:text-green-600 ${
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
            className={`font-semibold block mb-2 group-hover:text-purple-600 ${
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
              // 'training-'로 시작하는 ID는 클릭 시 아무 동작도 하지 않음
              if (info.event.id.startsWith("training-")) {
                return;
              }
              // 개인 일정은 삭제 확인 창 띄움
              if (confirm(`'${info.event.title}' 일정을 삭제하시겠습니까?`)) {
                deleteEventMutation.mutate(info.event.id);
              }
            }}
          />
        </div>
      </div>

      {/* ======================= 모달 영역 (링크 연결됨) ======================= */}

      {/* 1. 결재 요청 모달 */}
      {modalType === "pending" && (
        <ListModalLayout
          title="결재 요청 목록"
          onClose={() => setModalType(null)}
          moreLink="/main/my-approval/pending" // 🔗 결재 대기함 연결
        >
          {approvalRequests.length > 0 ? (
            approvalRequests.map((v) => (
              <div
                key={v.id}
                className="bg-white p-4 border rounded-lg hover:shadow-sm transition-shadow flex justify-between items-center"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded">
                      휴가
                    </span>
                    <span className="font-semibold text-gray-800">
                      {v.userName}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {v.startDate} ~ {v.endDate} ({v.daysUsed}일)
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{v.reason}</p>
                </div>
                <button
                  onClick={() => handleApproveClick(v)}
                  className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors cursor-pointer"
                >
                  결재하기
                </button>
              </div>
            ))
          ) : (
            <EmptyState message="대기 중인 결재 요청이 없습니다." />
          )}
        </ListModalLayout>
      )}

      {/* 2. 업무 보고 모달 */}
      {modalType === "work" && (
        <ListModalLayout
          title="업무 보고 (공유)"
          onClose={() => setModalType(null)}
          moreLink="/main/my-approval/shared" // 🔗 수신/공유함 연결 (업무보고 포함됨)
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
            <EmptyState message="새로운 업무 보고가 없습니다." />
          )}
        </ListModalLayout>
      )}

      {/* 3. 결재 완료 모달 */}
      {modalType === "completed" && (
        <ListModalLayout
          title="결재 완료 내역 (전체)"
          onClose={() => setModalType(null)}
          moreLink="/main/my-approval/completed" // 🔗 결재 완료함 연결
        >
          {completedHistory.length > 0 ? (
            completedHistory.map((v) => (
              <div
                key={v.id}
                className="bg-gray-50 p-4 border rounded-lg flex justify-between items-center"
              >
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
          title="공유 내용 (보고서/품의/공지 등)"
          onClose={() => setModalType(null)}
          moreLink="/main/my-approval/shared" // 🔗 수신/공유함 연결
        >
          {sharedContents.length > 0 ? (
            sharedContents.map((noti) => (
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

      {/* 승인 확인 팝업 (기존 유지) */}
      {selectedVacationForApprove && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-[400px] shadow-2xl">
            <h3 className="text-lg font-bold mb-4">결재 승인 확인</h3>
            <p className="text-gray-700 mb-6">
              <span className="font-semibold">
                {selectedVacationForApprove.userName}
              </span>
              님의 휴가 신청을 승인하시겠습니까?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSelectedVacationForApprove(null)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
              >
                취소
              </button>
              <button
                onClick={confirmApprove}
                disabled={approveMutation.isPending}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-bold disabled:bg-gray-400"
              >
                {approveMutation.isPending ? "처리중..." : "승인확정"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// [4] 하위 컴포넌트 수정 (더보기 버튼 추가)
// -----------------------------------------------------------------------

function ListModalLayout({
  title,
  onClose,
  children,
  moreLink, // ✅ 더보기 링크 prop 추가
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  moreLink?: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl p-6 w-[600px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black text-2xl font-light cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-3">{children}</div>

        {/* ✅ 푸터: 닫기 & 더보기 버튼 */}
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

// 데이터 없음 표시
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
      <p>{message}</p>
    </div>
  );
}

// 알림 아이템 (링크 이동)
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
  };
  const colorClass: Record<string, string> = {
    daily: "bg-blue-100 text-blue-700",
    weekly: "bg-indigo-100 text-indigo-700",
    report: "bg-purple-100 text-purple-700",
    approval: "bg-pink-100 text-pink-700",
    notice: "bg-orange-100 text-orange-700",
    resource: "bg-gray-200 text-gray-700",
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
              {new Date(noti.createdAt).toLocaleDateString()}{" "}
              {new Date(noti.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
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
