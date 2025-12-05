"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useEffect, useState } from "react";
import VacationWrite from "../write/vacationWrite";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

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

export default function UserV() {
  const [activeTab, setActiveTab] = useState<"vacation" | "vacationWrite">(
    "vacation"
  );

  // ✅ Redux 로그인 정보 가져오기
  const { userDocId, userName } = useSelector((state: RootState) => state.auth);

  // ✅ 개인 요약 데이터
  const [remaining, setRemaining] = useState<number>(0);
  const [used, setUsed] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [myVacations, setMyVacations] = useState<VacationResponse[]>([]);

  // ✅ 모달 상태 관리
  const [showModal, setShowModal] = useState(false); // 대기(결재 요청) 모달
  const [showUsedModal, setShowUsedModal] = useState(false); // 사용 완료 모달
  const [selectedUsedVacation, setSelectedUsedVacation] =
    useState<VacationResponse | null>(null);

  // ✅ 전체 휴가 데이터 (캘린더용)
  const [events, setEvents] = useState<VacationEvent[]>([]);

  // 휴가 결재 리스트
  const fetchMyVacations = async () => {
    if (!userDocId) return;
    try {
      const res = await fetch(`/api/vacation/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", userName: userDocId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMyVacations(data.list || []); // 👈 data.list 사용
      }
    } catch (err) {
      console.error("내 휴가 내역 조회 실패:", err);
    }
  };

  useEffect(() => {
    if (!userDocId) return;
    fetchMyVacations();
  }, [userDocId]);

  const fetchUserData = async () => {
    try {
      // employee/{userDocId}
      const empRes = await fetch(`/api/vacation/user?userDocId=${userDocId}`);
      const empData = await empRes.json();
      if (empRes.ok) {
        setRemaining(empData.remainingVacation ?? 0);
        setUsed(empData.usedVacation ?? 0);
      }

      // 2️⃣ vacation/{userDocId}/requests 중 status: 대기
      const reqRes = await fetch(
        `/api/vacation/pending?userDocId=${userDocId}`
      );
      const reqData = await reqRes.json();
      if (reqRes.ok) {
        setPendingCount(reqData.pendingCount ?? 0);
      }
    } catch (err) {
      console.error("❌ 개인 데이터 조회 실패:", err);
    }
  };

  useEffect(() => {
    if (!userDocId) return;
    fetchUserData();
  }, [userDocId]);

  // ✅ 전체 임직원 휴가 일정 가져오기
  useEffect(() => {
    const fetchAllVacations = async () => {
      try {
        const res = await fetch("/api/vacation/list");
        const data = await res.json();

        if (!res.ok) throw new Error("API 요청 실패");

        // ✅ 승인된 항목만 필터링
        const approvedVacations: VacationResponse[] = data.requests.filter(
          (v: VacationResponse) => v.status === "최종 승인 완료"
        );

        // ✅ FullCalendar에 맞게 endDate 하루 추가
        const mapped: VacationEvent[] = approvedVacations.map((v) => {
          const endPlusOne = new Date(v.endDate);
          endPlusOne.setDate(endPlusOne.getDate() + 1);

          return {
            title: `${v.userName} (${v.types})`,
            start: v.startDate,
            end: endPlusOne.toISOString().split("T")[0], // 하루 더한 날짜
            backgroundColor: "#4caf50",
          };
        });

        setEvents(mapped);
      } catch (err) {
        console.error("❌ 전체 휴가 조회 실패:", err);
      }
    };

    fetchAllVacations();
  }, []);

  // 휴가 취소 핸들러 함수
  const handleCancelVacation = async (vacationId: string) => {
    if (!window.confirm("이 휴가 요청을 정말로 취소하시겠습니까?")) {
      return;
    }

    try {
      const res = await fetch("/api/vacation/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacationId: vacationId,
          applicantUserName: userDocId, // 내 userDocId 전송
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "휴가 취소에 실패했습니다.");
      }

      alert("휴가 요청이 취소되었습니다.");
      // 목록과 카드 카운트를 새로고침
      fetchMyVacations();
      fetchUserData();
    } catch (err) {
      console.error("휴가 취소 오류:", err);
      alert(
        err instanceof Error ? err.message : "취소 중 오류가 발생했습니다."
      );
    }
  };

  // 사용 완료된 휴가만 필터링 함수
  const getUsedVacations = () => {
    return myVacations.filter((v) => v.status === "최종 승인 완료");
  };

  // 날짜 포맷팅 헬퍼 함수
  const formatDate = (
    dateValue: string | FirestoreTimestamp | undefined | null
  ) => {
    if (!dateValue) return "-";

    let date: Date;

    // dateValue가 객체이고 seconds 속성이 있다면 Firestore Timestamp로 간주
    if (typeof dateValue === "object" && "seconds" in dateValue) {
      date = new Date(dateValue.seconds * 1000);
    } else {
      // 그 외에는 문자열로 간주하여 Date 변환
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
    return <VacationWrite onCancel={() => setActiveTab("vacation")} />;
  }

  return (
    <div className="flex flex-col gap-12 w-full">
      <div className="flex items-center relative">
        <div className="ml-auto relative">
          <button
            className="px-4 py-2 rounded-xl border border-[#519d9e] hover:bg-[#519d9e] hover:text-white cursor-pointer"
            onClick={() => {
              setActiveTab("vacationWrite");
            }}
          >
            휴가원 작성 ▾
          </button>
        </div>
      </div>

      {/* 개인 휴가 현황 */}
      <div className="flex justify-center gap-10">
        <div className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center">
          <span className="text-gray-600 font-medium">미사용 휴가 일수</span>
          <p className="text-4xl font-bold">{remaining} 개</p>
        </div>
        <div
          className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setShowUsedModal(true)}
        >
          <span className="text-gray-600 font-medium">사용 휴가 일수</span>
          <p className="text-4xl font-bold">{used} 개</p>
        </div>
        <div
          className="bg-white shadow-md border rounded-2xl p-6 w-80 text-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setShowModal(true)}
        >
          <span className="text-gray-600 font-medium">휴가 결재 요청</span>
          <p className="text-4xl font-bold">{pendingCount} 건</p>
        </div>
      </div>

      {/* 🔹 휴가 결재 요청 모달 (일반 유저) */}
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
                            : v.status === "1차 결재 완료" // 👈 1차 결재 완료 상태 추가
                            ? "text-yellow-600"
                            : v.status === "최종 승인 완료" // 👈 '승인' -> '최종 승인 완료'
                            ? "text-green-600"
                            : v.status === "반려"
                            ? "text-red-500"
                            : "text-gray-600"
                        }`}
                      >
                        {v.status}
                      </span>

                      {/* 🔽 [신규] "대기" 상태일 때만 "취소" 버튼 표시 */}
                      {v.status === "대기" && (
                        <button
                          onClick={() => handleCancelVacation(v.id)}
                          className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-[#f87171] transition-colors cursor-pointer"
                        >
                          취소
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

      {/* 🔹 사용 휴가 내역 모달 (최종 승인 완료만 표시) */}
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
                    // 🔽 [3] 클릭 시 상세 모달 열기
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
