"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// 타입 정의 (기존과 동일)
type EventType = { id?: string; title: string; start: string; end?: string };

type NewEventType = {
  docId: string;
  title: string;
  start: string;
  end: string;
};

type VacationType = {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  approvers: { first?: string[]; second?: string[] };
  daysUsed: number;
};

// API 호출 함수들 (fetcher)
const fetchPending = async (userDocId: string, role: string | null) => {
  const res = await fetch("/api/vacation/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, userName: userDocId }),
  });
  const data = await res.json();
  return data.list || [];
};

const fetchCompleted = async (userDocId: string) => {
  const res = await fetch("/api/vacation/approve-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: userDocId }),
  });
  const data = await res.json();
  return data.list || [];
};

const fetchShared = async (userDocId: string) => {
  const res = await fetch("/api/vacation/shared-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: userDocId }),
  });
  const data = await res.json();
  return data.list || [];
};

const fetchEvents = async (userDocId: string) => {
  const res = await fetch(
    `/api/today/list?docId=${encodeURIComponent(userDocId)}`
  );
  return res.json();
};

export default function Individual() {
  const { userDocId, userName, role } = useSelector(
    (state: RootState) =>
      state.auth || { userDocId: null, userName: "사용자", role: null }
  );
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showSharedModal, setShowSharedModal] = useState(false);
  const [selectedVacation, setSelectedVacation] = useState<VacationType | null>(
    null
  );

  // ✅ 1. React Query: 데이터 조회 (자동 캐싱 & 리패칭)
  const { data: pendingList = [] } = useQuery({
    queryKey: ["vacations", "pending", userDocId],
    queryFn: () => fetchPending(userDocId!, role),
    enabled: !!userDocId, // userDocId가 있을 때만 실행
  });

  const { data: completedList = [] } = useQuery({
    queryKey: ["vacations", "completed", userDocId],
    queryFn: () => fetchCompleted(userDocId!),
    enabled: !!userDocId,
  });

  const { data: sharedList = [] } = useQuery({
    queryKey: ["vacations", "shared", userDocId],
    queryFn: () => fetchShared(userDocId!),
    enabled: !!userDocId,
  });

  const { data: events = [] } = useQuery<EventType[]>({
    queryKey: ["events", userDocId],
    queryFn: () => fetchEvents(userDocId!),
    enabled: !!userDocId,
  });

  // ✅ 2. React Query: 승인 Mutation
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
      if (!res.ok) throw new Error("승인 실패");
      return res.json();
    },
    onSuccess: () => {
      alert("승인되었습니다.");
      // 데이터가 변경되었으므로 목록을 새로고침(Invalidate)
      queryClient.invalidateQueries({ queryKey: ["vacations"] });
      setSelectedVacation(null);
    },
    onError: (err) => alert(err.message),
  });

  // ✅ 3. React Query: 일정 추가 Mutation
  const addEventMutation = useMutation({
    mutationFn: async (newEvent: NewEventType) => {
      const res = await fetch("/api/today/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEvent),
      });
      if (!res.ok) throw new Error("추가 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  // ✅ 4. React Query: 일정 삭제 Mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch("/api/today/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: userDocId, eventId }),
      });
      if (!res.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const handleApprove = (id: string, applicant: string) => {
    if (confirm("승인하시겠습니까?")) {
      approveMutation.mutate({ id, applicant });
    }
  };

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

  return (
    <div className="flex flex-col gap-12 mt-6 items-center">
      {/* 상단 카드 영역 */}
      <div className="flex justify-center gap-10">
        <div
          className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center cursor-pointer hover:bg-gray-50"
          onClick={() => setShowModal(true)}
        >
          <span className="text-gray-600 font-medium">결재 요청</span>
          <p className="text-4xl font-bold">{pendingList.length} 건</p>
        </div>
        <div
          className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center cursor-pointer hover:bg-gray-50"
          onClick={() => setShowCompletedModal(true)}
        >
          <span className="text-gray-600 font-medium">결재 완료 (오늘)</span>
          <p className="text-4xl font-bold">{completedList.length} 건</p>
        </div>
        <div
          className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center cursor-pointer hover:bg-gray-50"
          onClick={() => setShowSharedModal(true)}
        >
          <span className="text-gray-600 font-medium">공유 내용</span>
          <p className="text-4xl font-bold">{sharedList.length} 건</p>
        </div>
      </div>

      {/* 모달: 결재 요청 목록 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl p-6 w-[600px] max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">결재 요청 목록</h3>
            <ul className="divide-y">
              {pendingList.length > 0 ? (
                pendingList.map((v: VacationType) => (
                  <li
                    key={v.id}
                    className="py-3 cursor-pointer hover:bg-gray-100 px-2 rounded"
                    onClick={() => setSelectedVacation(v)}
                  >
                    <p className="font-semibold">{v.userName}</p>
                    <p className="text-sm text-gray-600">
                      {v.startDate} ~ {v.endDate} ({v.daysUsed}일)
                    </p>
                    <span className="text-xs text-blue-500">{v.status}</span>
                  </li>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  대기 중인 결재가 없습니다.
                </p>
              )}
            </ul>
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full bg-gray-300 py-2 rounded hover:bg-gray-400"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 모달: 승인 상세 */}
      {selectedVacation && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl p-6 w-[500px]">
            <h3 className="text-lg font-bold mb-3">휴가 승인</h3>
            <div className="space-y-2 mb-6">
              <p>
                <strong>신청자:</strong> {selectedVacation.userName}
              </p>
              <p>
                <strong>기간:</strong> {selectedVacation.startDate} ~{" "}
                {selectedVacation.endDate}
              </p>
              <p>
                <strong>사유:</strong> {selectedVacation.reason}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  handleApprove(selectedVacation.id, selectedVacation.userName)
                }
                disabled={approveMutation.isPending}
                className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
              >
                {approveMutation.isPending ? "처리중..." : "승인"}
              </button>
              <button
                onClick={() => setSelectedVacation(null)}
                className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달: 결재 완료 목록 */}
      {showCompletedModal && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl p-6 w-[600px]">
            <h3 className="text-lg font-bold mb-4">오늘 결재 완료 목록</h3>
            <ul className="divide-y">
              {completedList.map((v: VacationType) => (
                <li key={v.id} className="py-3 px-2">
                  <p className="font-semibold">{v.userName}</p>
                  <p className="text-sm text-gray-600">
                    {v.startDate} ~ {v.endDate}
                  </p>
                  <span className="text-xs text-green-600">{v.status}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowCompletedModal(false)}
              className="mt-4 w-full bg-gray-300 py-2 rounded hover:bg-gray-400"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 모달: 공유 내용 */}
      {showSharedModal && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl p-6 w-[600px]">
            <h3 className="text-lg font-bold mb-4">공유 목록</h3>
            <ul className="divide-y">
              {sharedList.map((v: VacationType) => (
                <li key={v.id} className="py-3 px-2">
                  <p className="font-semibold">{v.userName}</p>
                  <p className="text-sm text-gray-600">
                    {v.startDate} ~ {v.endDate}
                  </p>
                  <span className="text-xs text-gray-500">{v.status}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowSharedModal(false)}
              className="mt-4 w-full bg-gray-300 py-2 rounded hover:bg-gray-400"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 캘린더 */}
      <div className="bg-white shadow-md border rounded-2xl p-6 w-[1200px] mx-auto">
        <h2 className="text-lg font-semibold mb-4">📅 {userName}님의 일정</h2>
        <div className="h-[600px]">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={events}
            dateClick={handleDateClick}
            eventClick={(info) => {
              if (confirm("일정을 삭제하시겠습니까?")) {
                deleteEventMutation.mutate(info.event.id);
              }
            }}
            height="100%"
          />
        </div>
      </div>
    </div>
  );
}
