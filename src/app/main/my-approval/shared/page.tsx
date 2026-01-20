"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import VacationModal from "@/components/vacationModal";

// ✅ 타입 정의 (기존 유지)
interface NotificationItem {
  id: string;
  fromUserName: string;
  type: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: number;
  vacationId?: string;
}

interface NotificationApiResponse {
  list: NotificationItem[];
  totalCount: number;
}

// ✅ VacationDetail 타입 수정
interface VacationDetail {
  userName: string;
  startDate: string;
  endDate: string;
  status: string;
  daysUsed: number;
  reason: string;
  type: string;
  types?: string[];
  approvers?: {
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };
  approvalHistory?: {
    approver: string;
    status: string;
    comment?: string;
    approvedAt: number;
  }[];
}

const fetchNotifications = async (
  userName: string,
  page: number,
  limit: number,
  filterType: string
) => {
  const res = await fetch("/api/notifications/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, page, limit, filterType }),
  });
  if (!res.ok) throw new Error("Fetch failed");
  return res.json();
};

const formatCustomDate = (timestamp: number) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function SharedBoxContent() {
  const { userName } = useSelector(
    (state: RootState) => state.auth || { userName: "사용자" }
  );
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPage = Number(searchParams.get("page")) || 1;
  const [filterType, setFilterType] = useState("all");
  const ITEMS_PER_PAGE = 12;

  const [selectedVacation, setSelectedVacation] =
    useState<VacationDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading } = useQuery<NotificationApiResponse>({
    queryKey: ["notifications", userName, currentPage, filterType],
    queryFn: () =>
      fetchNotifications(userName!, currentPage, ITEMS_PER_PAGE, filterType),
    enabled: !!userName,
    placeholderData: (previousData) => previousData,
  });

  const list = data?.list || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;

  const typeLabels: Record<string, string> = {
    daily: "일일 업무",
    daily_comment: "댓글",
    weekly: "주간 업무",
    weekly_comment: "댓글(주간)",
    report: "보고서",
    approval: "품의서",
    notice: "공지사항",
    resource: "자료실",
    vacation: "휴가원",
    vacation_request: "휴가신청",
    vacation_complete: "휴가승인",
    vacation_reject: "휴가반려",
  };

  const colorClass: Record<string, string> = {
    daily: "bg-blue-100 text-blue-700",
    daily_comment: "bg-blue-50 text-blue-600",
    weekly: "bg-indigo-100 text-indigo-700",
    weekly_comment: "bg-indigo-50 text-indigo-600",
    report: "bg-purple-100 text-purple-700",
    approval: "bg-pink-100 text-pink-700",
    notice: "bg-orange-100 text-orange-700",
    resource: "bg-gray-200 text-gray-700",
    vacation: "bg-red-100 text-red-700",
    vacation_request: "bg-red-100 text-red-700",
    vacation_complete: "bg-green-100 text-green-700",
    vacation_reject: "bg-red-200 text-red-800",
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterType(e.target.value);
    router.push("?page=1");
  };

  const handlePrevPage = () => {
    if (currentPage > 1) router.push(`?page=${currentPage - 1}`);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) router.push(`?page=${currentPage + 1}`);
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (item.type.includes("vacation")) {
      if (!item.vacationId) {
        alert("상세 정보를 불러올 수 없습니다. (ID 누락)");
        return;
      }

      try {
        const res = await fetch("/api/vacation/detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vacationId: item.vacationId,
            viewerName: userName,
          }),
        });

        const detail = await res.json();

        if (!res.ok) {
          throw new Error(
            detail.error || "상세 정보를 가져오는데 실패했습니다."
          );
        }

        setSelectedVacation(detail);
        setIsModalOpen(true);
      } catch (e: unknown) {
        console.error(e);
        const errorMessage = e instanceof Error ? e.message : "알 수 없는 오류";
        alert(`오류: ${errorMessage}`);
      }
    } else {
      router.push(item.link);
    }
  };

  // ✅ 날짜 변환 헬퍼
  const formatHistoryDate = (timestamp: number | undefined) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ✅ 결재자 렌더링 헬퍼 (스타일 개선)
  const renderApproverRow = (roleName: string, approvers: string[] = []) => {
    if (approvers.length === 0) return null;

    return approvers.map((name) => {
      const history = selectedVacation?.approvalHistory?.find(
        (h) => h.approver === name
      );
      const isApproved = !!history;
      const isRejected = history?.status === "반려";

      return (
        <div
          key={name}
          className="flex justify-between items-center text-xs border-b border-dashed border-gray-200 py-1 last:border-0"
        >
          <div className="flex items-center gap-1">
            <span className="text-gray-400 font-normal">[{roleName}]</span>
            <span className="font-semibold text-gray-700">{name}</span>
          </div>
          {isRejected ? (
            <span className="text-red-600 font-bold">
              [반려] {formatHistoryDate(history?.approvedAt)}
            </span>
          ) : isApproved ? (
            <span className="text-green-600 font-bold">
              [승인] {formatHistoryDate(history?.approvedAt)}
            </span>
          ) : (
            <span className="text-gray-400">[대기]</span>
          )}
        </div>
      );
    });
  };

  if (isLoading && !data)
    return <div className="p-6 text-gray-500">로딩 중...</div>;

  return (
    <div className="p-6 w-full">
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        {/* 상단 필터 영역 */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-purple-600">📭 수신/공유함</h2>
          <select
            value={filterType}
            onChange={handleFilterChange}
            className="border p-2 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-purple-200 outline-none cursor-pointer"
          >
            <option value="all">전체 보기</option>
            <option value="vacation">휴가</option>
            <option value="daily">일일 업무</option>
            <option value="weekly">주간 업무</option>
            <option value="approval">품의서</option>
            <option value="report">보고서</option>
            <option value="notice">공지사항</option>
            <option value="resource">자료실</option>
          </select>
        </div>

        {/* 리스트 영역 */}
        {list.length === 0 ? (
          <p className="text-center text-gray-400 py-10">내역이 없습니다.</p>
        ) : (
          <>
            <ul className="divide-y">
              {list.map((item) => (
                <li
                  key={item.id}
                  className="py-3 px-2 hover:bg-gray-50 rounded group cursor-pointer"
                  onClick={() => handleItemClick(item)}
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 text-xs font-bold rounded ${
                          colorClass[item.type] || "bg-gray-200"
                        }`}
                      >
                        {typeLabels[item.type] || item.type}
                      </span>
                      <div>
                        <p className="text-gray-800 font-medium group-hover:text-purple-600 transition-colors">
                          {item.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <span>보낸사람: {item.fromUserName}</span>
                          <span className="text-gray-300">|</span>
                          <span className="text-gray-500">
                            {formatCustomDate(item.createdAt)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {item.type.includes("vacation") ? "상세보기" : "바로가기"}{" "}
                      &gt;
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex justify-center items-center gap-4 mt-6 py-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  currentPage === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                    : "bg-white text-gray-700 hover:bg-gray-50 hover:text-purple-600 border-gray-300"
                }`}
              >
                ◀ 이전
              </button>

              <span className="text-sm font-medium text-gray-600">
                Page{" "}
                <span className="text-purple-600 font-bold">{currentPage}</span>{" "}
                / {totalPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  currentPage === totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                    : "bg-white text-gray-700 hover:bg-gray-50 hover:text-purple-600 border-gray-300"
                }`}
              >
                다음 ▶
              </button>
            </div>
          </>
        )}
      </div>

      {/* ✅ 휴가 상세 모달 */}
      {isModalOpen && selectedVacation && (
        <VacationModal onClose={() => setIsModalOpen(false)}>
          <div className="flex flex-col gap-6">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-4">
              ✅ 휴가 상세 정보
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-gray-500 font-bold mb-1">
                  신청자
                </span>
                <p className="text-gray-800">{selectedVacation.userName}</p>
              </div>

              {/* ✅ [수정] 상태 영역에 결재 진행 현황 통합 */}
              <div className="row-span-2">
                <span className="block text-gray-500 font-bold mb-1">상태</span>
                <div className="bg-gray-50 p-2 rounded border border-gray-200">
                  {/* 메인 상태 뱃지 */}
                  <span
                    className={`inline-block mb-2 px-2 py-0.5 rounded text-xs font-bold ${
                      selectedVacation.status.includes("승인")
                        ? "bg-green-100 text-green-700"
                        : selectedVacation.status.includes("반려")
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {selectedVacation.status}
                  </span>

                  {/* 세부 결재 라인 */}
                  <div className="flex flex-col gap-1">
                    {renderApproverRow(
                      "1차",
                      selectedVacation.approvers?.first
                    )}
                    {renderApproverRow(
                      "2차",
                      selectedVacation.approvers?.second
                    )}
                    {renderApproverRow(
                      "3차",
                      selectedVacation.approvers?.third
                    )}
                  </div>
                </div>
              </div>

              {/* 나머지 정보들 */}
              <div>
                <span className="block text-gray-500 font-bold mb-1">
                  사용일수
                </span>
                <p className="text-gray-800">{selectedVacation.daysUsed}일</p>
              </div>

              <div className="col-span-2">
                <span className="block text-gray-500 font-bold mb-1">기간</span>
                <p className="text-gray-800">
                  {selectedVacation.startDate} ~ {selectedVacation.endDate}
                </p>
              </div>

              <div className="col-span-2">
                <span className="block text-gray-500 font-bold mb-1">종류</span>
                <p className="text-gray-800">
                  {Array.isArray(selectedVacation.types) &&
                  selectedVacation.types.length > 0
                    ? selectedVacation.types.join(", ")
                    : selectedVacation.type}
                </p>
              </div>
            </div>

            <div>
              <span className="block text-gray-500 font-bold mb-2">사유</span>
              <div className="bg-gray-50 p-4 rounded-lg text-gray-700 text-sm min-h-[80px] border">
                {selectedVacation.reason}
              </div>
            </div>

            {selectedVacation.approvalHistory &&
              selectedVacation.approvalHistory.some((h) => h.comment) && (
                <div>
                  <span className="block text-gray-500 font-bold mb-2">
                    결재 의견
                  </span>
                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 flex flex-col gap-2">
                    {selectedVacation.approvalHistory.map((history, idx) =>
                      history.comment ? (
                        <div
                          key={idx}
                          className="text-sm border-b border-yellow-200 last:border-0 pb-2 last:pb-0"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-gray-800">
                              {history.approver}
                              <span
                                className={`ml-1 text-xs ${
                                  history.status === "반려"
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                ({history.status})
                              </span>
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatHistoryDate(history.approvedAt)}
                            </span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {history.comment}
                          </p>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

            <div className="flex justify-end mt-4 pt-4 border-t">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </VacationModal>
      )}
    </div>
  );
}

export default function SharedBoxPage() {
  return (
    <Suspense fallback={<div className="p-6">페이지 로딩 중...</div>}>
      <SharedBoxContent />
    </Suspense>
  );
}
