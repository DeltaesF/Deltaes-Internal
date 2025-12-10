"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Link from "next/link";
import VacationWritePage from "../write/page";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}
interface VacationEvent {
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
}

interface VacationResponse {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  types: string;
  status: string;
  daysUsed: number;
  reason?: string;
  approvalHistory?: {
    approver: string;
    status: string;
    approvedAt: string | FirestoreTimestamp;
  }[];
}

// -----------------------------------------------------------------------
// [1] Fetcher 함수들 (API 호출 담당)
// -----------------------------------------------------------------------

// 1. 내 휴가 목록 조회
const fetchMyVacations = async (userDocId: string) => {
  const res = await fetch(`/api/vacation/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "user", userName: userDocId }),
  });
  const data = await res.json();
  return (data.list as VacationResponse[]) || [];
};

// 2. 내 연차 정보 (잔여/사용) 조회
const fetchUserStats = async (userDocId: string) => {
  const res = await fetch(`/api/vacation/user?userDocId=${userDocId}`);
  return res.json();
};

// 3. 결재 대기 건수 조회
const fetchPendingCount = async (userDocId: string) => {
  const res = await fetch(`/api/vacation/pending?userDocId=${userDocId}`);
  return res.json();
};

// 4. 전체 휴가 일정 (캘린더용) 조회
const fetchAllVacations = async () => {
  const res = await fetch("/api/vacation/list"); // GET 요청
  const data = await res.json();
  const requests: VacationResponse[] = data.requests || [];

  // 승인된 것만 필터링 후 캘린더 이벤트 포맷으로 변환
  return requests
    .filter((v) => v.status === "최종 승인 완료")
    .map((v) => {
      const endPlusOne = new Date(v.endDate);
      endPlusOne.setDate(endPlusOne.getDate() + 1);
      return {
        title: `${v.userName} (${v.types})`,
        start: v.startDate,
        end: endPlusOne.toISOString().split("T")[0],
        backgroundColor: "#4caf50",
      } as VacationEvent;
    });
};

// -----------------------------------------------------------------------
// [2] 컴포넌트 시작
// -----------------------------------------------------------------------

export default function UserV() {
  const [activeTab, setActiveTab] = useState<"vacation" | "vacationWrite">(
    "vacation"
  );

  // Redux
  const { userDocId } = useSelector((state: RootState) => state.auth);
  const queryClient = useQueryClient();

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [showUsedModal, setShowUsedModal] = useState(false);
  const [selectedUsedVacation, setSelectedUsedVacation] =
    useState<VacationResponse | null>(null);

  // =====================================================================
  // ✅ React Query: 데이터 조회 (useQuery)
  // =====================================================================

  // 1. 내 휴가 목록
  const { data: myVacations = [] } = useQuery({
    queryKey: ["vacations", "my", userDocId],
    queryFn: () => fetchMyVacations(userDocId!),
    enabled: !!userDocId,
  });

  // 2. 내 연차 정보 (잔여/사용)
  const { data: userStats = { remainingVacation: 0, usedVacation: 0 } } =
    useQuery({
      queryKey: ["vacations", "stats", userDocId],
      queryFn: () => fetchUserStats(userDocId!),
      enabled: !!userDocId,
    });

  // 3. 결재 대기 건수
  const { data: pendingData = { pendingCount: 0 } } = useQuery({
    queryKey: ["vacations", "pendingCount", userDocId],
    queryFn: () => fetchPendingCount(userDocId!),
    enabled: !!userDocId,
  });

  // 4. 캘린더 전체 일정 (키: 'vacations', 'calendar')
  const { data: events = [] } = useQuery({
    queryKey: ["vacations", "calendar"],
    queryFn: fetchAllVacations,
  });

  // =====================================================================
  // ✅ React Query: 데이터 변경 (useMutation) - 휴가 취소
  // =====================================================================
  const cancelMutation = useMutation({
    mutationFn: async (vacationId: string) => {
      const res = await fetch("/api/vacation/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacationId,
          applicantUserName: userDocId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "취소 실패");
      return data;
    },
    onSuccess: () => {
      alert("휴가 요청이 취소되었습니다.");
      // 🌟 핵심: 관련된 모든 쿼리를 무효화하여 자동 새로고침
      queryClient.invalidateQueries({ queryKey: ["vacations"] });
    },
    onError: (err) => {
      alert(err.message);
    },
  });

  const handleCancelVacation = (vacationId: string) => {
    if (confirm("이 휴가 요청을 정말로 취소하시겠습니까?")) {
      cancelMutation.mutate(vacationId);
    }
  };

  // 헬퍼 함수들
  const getUsedVacations = () => {
    return myVacations.filter((v) => v.status === "최종 승인 완료");
  };

  const formatDate = (
    dateValue: string | FirestoreTimestamp | undefined | null
  ) => {
    if (!dateValue) return "-";
    let date: Date;
    if (typeof dateValue === "object" && "seconds" in dateValue) {
      date = new Date(dateValue.seconds * 1000);
    } else {
      date = new Date(dateValue as string);
    }
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (activeTab === "vacationWrite") {
    return <VacationWritePage />;
  }

  return (
    <div className="flex flex-col gap-12 w-full">
      <div className="flex items-center relative">
        <div className="ml-auto relative flex gap-3">
          {/* ✅ [추가됨] 전체 현황 보기 버튼 (리스트 페이지로 이동) */}
          <Link
            href="/main/vacation/list"
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-black cursor-pointer text-sm transition-colors flex items-center"
          >
            📋 휴가 현황 보기
          </Link>

          <Link
            href="/main/vacation/write"
            className="px-4 py-2 rounded-xl border border-[#519d9e] hover:bg-[#519d9e] hover:text-white cursor-pointer text-sm transition-colors"
          >
            휴가원 작성 ▾
          </Link>
        </div>
      </div>

      {/* 개인 휴가 현황 */}
      <div className="flex justify-center gap-10">
        <div className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center">
          <span className="text-gray-600 font-medium">미사용 휴가 일수</span>
          <p className="text-4xl font-bold">
            {userStats.remainingVacation ?? 0} 개
          </p>
        </div>
        <div
          className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setShowUsedModal(true)}
        >
          <span className="text-gray-600 font-medium">사용 휴가 일수</span>
          <p className="text-4xl font-bold">{userStats.usedVacation ?? 0} 개</p>
        </div>
        <div
          className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setShowModal(true)}
        >
          <span className="text-gray-600 font-medium">휴가 결재 요청</span>
          <p className="text-4xl font-bold">{pendingData.pendingCount} 건</p>
        </div>
      </div>

      {/* 🔹 휴가 결재 요청 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl p-6 w-[600px]">
            <h3 className="text-lg font-bold mb-4">휴가 결재 요청 내역</h3>
            <ul className="divide-y">
              {myVacations.length > 0 ? (
                myVacations.map((v) => (
                  <li key={v.startDate + v.userName} className="py-3 px-2">
                    <p className="font-semibold">
                      {v.types}{" "}
                      <span className="text-gray-500 font-normal">
                        ({v.daysUsed}일)
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      {v.startDate} ~ {v.endDate}
                    </p>
                    <div className="flex justify-between items-center mt-1">
                      <span
                        className={`text-sm font-medium ${
                          v.status === "대기"
                            ? "text-blue-500"
                            : v.status === "1차 결재 완료"
                            ? "text-yellow-600"
                            : v.status === "최종 승인 완료"
                            ? "text-green-600"
                            : v.status === "반려"
                            ? "text-red-500"
                            : "text-gray-600"
                        }`}
                      >
                        {v.status}
                      </span>

                      {/* 대기 상태일 때만 취소 버튼 표시 */}
                      {v.status === "대기" && (
                        <button
                          onClick={() => handleCancelVacation(v.id)}
                          disabled={cancelMutation.isPending}
                          className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-[#f87171] transition-colors cursor-pointer disabled:bg-gray-300"
                        >
                          {cancelMutation.isPending ? "처리중..." : "취소"}
                        </button>
                      )}
                    </div>
                  </li>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  휴가 결재 요청 내역이 없습니다.
                </p>
              )}
            </ul>
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 🔹 사용 휴가 내역 모달 */}
      {showUsedModal && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl p-6 w-[600px]">
            <h3 className="text-lg font-bold mb-4">사용 휴가 내역 (완료)</h3>
            <p className="text-sm text-gray-500 mb-2">
              항목을 클릭하면 상세 내용을 볼 수 있습니다.
            </p>
            <ul className="divide-y max-h-[400px] overflow-y-auto">
              {getUsedVacations().length > 0 ? (
                getUsedVacations().map((v) => (
                  <li
                    key={v.id}
                    className="py-3 px-2 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setSelectedUsedVacation(v)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">
                          {v.types}{" "}
                          <span className="text-gray-500 font-normal">
                            ({v.daysUsed}일)
                          </span>
                        </p>
                        <p className="text-sm text-gray-600">
                          {v.startDate} ~ {v.endDate}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-green-600">
                        {v.status}
                      </span>
                    </div>
                  </li>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  사용 완료된 휴가 내역이 없습니다.
                </p>
              )}
            </ul>
            <button
              onClick={() => setShowUsedModal(false)}
              className="mt-4 bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 상세 보기 모달 */}
      {selectedUsedVacation && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-[500px] shadow-2xl">
            <h3 className="text-xl font-bold mb-4 border-b pb-2">
              휴가 상세 내용
            </h3>

            <div className="space-y-3 mb-6">
              <div>
                <span className="text-gray-500 text-sm">신청자</span>
                <p className="font-semibold">{selectedUsedVacation.userName}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">휴가 종류 및 기간</span>
                <p className="font-medium">
                  {selectedUsedVacation.types} ({selectedUsedVacation.daysUsed}
                  일)
                </p>
                <p className="text-sm text-gray-700">
                  {selectedUsedVacation.startDate} ~{" "}
                  {selectedUsedVacation.endDate}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">사유</span>
                <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedUsedVacation.reason || "내용 없음"}
                </div>
              </div>

              {/* 결재 이력 표시 */}
              <div>
                <span className="text-gray-500 text-sm">결재 이력</span>
                <div className="mt-1 border rounded divide-y">
                  {selectedUsedVacation.approvalHistory &&
                  selectedUsedVacation.approvalHistory.length > 0 ? (
                    selectedUsedVacation.approvalHistory.map((history, idx) => (
                      <div
                        key={idx}
                        className="p-2 flex justify-between items-center text-sm"
                      >
                        <div>
                          <span className="font-semibold mr-2">
                            {history.approver}
                          </span>
                          <span className="text-gray-500 text-xs">
                            ({history.status})
                          </span>
                        </div>
                        <span className="text-gray-400 text-xs">
                          {formatDate(history.approvedAt)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="p-2 text-sm text-gray-400">
                      결재 이력이 없습니다.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedUsedVacation(null)}
                className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 캘린더 영역 */}
      <div className="bg-white shadow-md border rounded-2xl p-6 w-[1200px] mx-auto">
        <h2 className="text-lg font-semibold mb-4">임직원 휴가</h2>
        <div className="w-[1100px] h-[500px] mx-auto">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="100%"
            events={events}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek,dayGridDay",
            }}
          />
        </div>
      </div>
    </div>
  );
}
