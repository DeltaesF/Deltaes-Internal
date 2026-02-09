"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import VacationModal from "@/components/vacationModal";

// ✅ [1] 타입 정의 (Strict Typing)
interface ApprovalHistory {
  approver: string;
  status: string;
  comment?: string;
  approvedAt: number; // 숫자(밀리초)로 변환됨
}

interface CompletedItem {
  id: string;
  userName: string;
  status: string;
  category: "vacation" | "report" | "approval";
  createdAt: number;

  // 휴가용
  startDate?: string;
  endDate?: string;
  daysUsed?: number;
  reason?: string;
  types?: string | string[];

  // 보고서/품의서/통합용
  title?: string;
  approvalType?: string; // 추가: 문서 타입 확인용
  workType?: string; // 추가: 외근/출장 구분용
  docCategory?: string; // 추가: 보고서 구분용
  implementDate?: string;

  approvers?: {
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };
  approvalHistory?: ApprovalHistory[];
}

interface CompletedApiResponse {
  list: CompletedItem[];
  totalCount: number;
}

// ✅ API Fetcher
const fetchCompleted = async (
  userName: string,
  page: number,
  limit: number,
  filterType: string
) => {
  const res = await fetch("/api/vacation/approve-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, page, limit, filterType }),
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

const formatHistoryDate = (timestamp: number | undefined) => {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ------------------------------------------------------------------
// ✅ [2] 메인 콘텐츠 컴포넌트
// ------------------------------------------------------------------
function CompletedApprovalContent() {
  const { userName } = useSelector((state: RootState) => state.auth);
  const router = useRouter();

  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState("all");
  const ITEMS_PER_PAGE = 12;

  const [selectedVacation, setSelectedVacation] =
    useState<CompletedItem | null>(null);

  const { data, isLoading } = useQuery<CompletedApiResponse>({
    queryKey: ["completedHistory", userName, currentPage, filterType],
    queryFn: () =>
      fetchCompleted(userName!, currentPage, ITEMS_PER_PAGE, filterType),
    enabled: !!userName,
    placeholderData: (prev) => prev,
    refetchOnMount: true,
  });

  const list = data?.list || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;

  // ✅ [핵심] 아이템 클릭 핸들러 (이동 로직 개선)
  const handleItemClick = (item: CompletedItem) => {
    // 1. 통합 외근/출장/보고서인 경우 -> 통합 상세 페이지로 이동
    if (item.approvalType === "integrated_outside") {
      router.push(`/main/workoutside/approvals/${item.id}`);
      return;
    }

    // 2. 휴가인 경우 -> 모달 열기 (제목이 없고 날짜가 있는 경우)
    if (item.category === "vacation" && !item.title) {
      setSelectedVacation(item);
      return;
    }

    // 3. 그 외 (기존 보고서/품의서)
    if (item.category === "report") {
      router.push(`/main/report/${item.id}`);
    } else {
      router.push(`/main/workoutside/approvals/${item.id}`);
    }
  };

  // ✅ [핵심] 뱃지 렌더링 (통합 문서 지원)
  const getCategoryBadge = (item: CompletedItem) => {
    // 1. 통합 외근/출장 문서
    if (item.approvalType === "integrated_outside") {
      if (item.workType === "outside")
        return (
          <span className="bg-[#519d9e] text-white px-2 py-0.5 rounded text-xs font-bold">
            [외근]
          </span>
        );
      if (item.workType === "trip")
        return (
          <span className="bg-[#519d9e] text-white px-2 py-0.5 rounded text-xs font-bold">
            [출장]
          </span>
        );
      if (item.workType === "outside_report")
        return (
          <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">
            [외근보고]
          </span>
        );
      if (item.workType === "trip_report")
        return (
          <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">
            [출장보고]
          </span>
        );
      return (
        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-bold">
          통합
        </span>
      );
    }

    // 2. 기존 카테고리
    switch (item.category) {
      case "vacation":
        return (
          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-bold">
            휴가
          </span>
        );
      case "report":
        return (
          <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">
            보고서
          </span>
        );
      case "approval":
        return (
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
            품의서
          </span>
        );
      default:
        return (
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-bold">
            기타
          </span>
        );
    }
  };

  // 헬퍼: 상세 모달 내 결재자 리스트
  const renderApproverRow = (roleName: string, approvers: string[] = []) => {
    if (!approvers || approvers.length === 0) return null;

    return approvers.map((name) => {
      const history = selectedVacation?.approvalHistory?.find(
        (h) => h.approver === name
      );
      const isApproved = !!history;
      const isRejected = history?.status === "반려";

      return (
        <div
          key={name}
          className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[11px] md:text-xs border-b border-dashed border-gray-200 py-1.5 last:border-0 gap-1 sm:gap-0"
        >
          <div className="flex items-center gap-1">
            <span className="text-gray-400 font-normal">[{roleName}]</span>
            <span className="font-semibold text-gray-700">{name}</span>
          </div>
          <div className="flex items-center">
            {isRejected ? (
              <span className="text-red-600 font-bold whitespace-nowrap">
                [반려] {formatHistoryDate(history?.approvedAt)}
              </span>
            ) : isApproved ? (
              <span className="text-green-600 font-bold whitespace-nowrap">
                [승인] {formatHistoryDate(history?.approvedAt)}
              </span>
            ) : (
              <span className="text-gray-400 font-medium">[대기]</span>
            )}
          </div>
        </div>
      );
    });
  };

  if (isLoading && !data) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="p-3 md:p-6 w-full min-w-0">
      {" "}
      {/* min-w-0: 부모 flex 레이아웃 붕괴 방지 */}
      <div className="bg-white border rounded-2xl shadow-sm px-4 md:px-6 py-4 w-full overflow-hidden">
        {/* 상단 필터 영역: 모바일 세로 배치 대응 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-xl md:text-2xl font-bold text-green-600 whitespace-nowrap">
            ✅ 결재 완료함
          </h2>

          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto border p-2 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-green-200 outline-none cursor-pointer"
          >
            <option value="all">전체 보기</option>
            <option value="vacation">휴가</option>
            <option value="report">보고서</option>
            <option value="approval">품의서</option>
          </select>
        </div>

        {list.length === 0 ? (
          <p className="text-center text-gray-400 py-10">
            완료된 결재 내역이 없습니다.
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {list.map((item) => (
                <li
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="py-4 px-1 md:px-3 hover:bg-green-50 rounded-lg cursor-pointer transition-colors group"
                >
                  <div className="flex justify-between items-center gap-3 w-full">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <div className="shrink-0">{getCategoryBadge(item)}</div>
                        <span className="bg-green-100 text-green-700 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded shrink-0">
                          {item.status}
                        </span>
                        <span className="font-bold text-gray-800 text-sm md:text-base truncate">
                          {item.userName}
                        </span>
                      </div>

                      <div className="ml-1">
                        {item.category === "vacation" ? (
                          <div className="text-xs md:text-sm text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="shrink-0 font-medium">
                              {item.startDate} ~ {item.endDate}
                            </span>
                            <span className="text-gray-400 hidden md:inline">
                              |
                            </span>
                            <span className="text-gray-500 text-[11px] md:text-xs truncate max-w-full sm:max-w-[300px] lg:max-w-[400px]">
                              📝 {item.reason}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs md:text-sm text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="shrink-0 font-medium">
                              {item.implementDate
                                ? item.implementDate
                                : new Date(item.createdAt)
                                    .toLocaleDateString("ko-KR", {
                                      year: "numeric",
                                      month: "2-digit",
                                      day: "2-digit",
                                    })
                                    .replace(/\. /g, "-")
                                    .replace(/\./g, "")}
                            </span>
                            <span className="text-gray-400 hidden md:inline">
                              |
                            </span>
                            <span className="text-black text-[11px] md:text-xs truncate max-w-full sm:max-w-[300px] lg:max-w-[400px] font-medium">
                              {item.title || "제목 없음"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <span className="shrink-0 text-[11px] md:text-xs text-green-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:inline">
                      상세보기 →
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {/* 페이지네이션 */}
            <div className="flex justify-center items-center gap-2 md:gap-4 mt-8 py-2">
              <button
                onClick={() => currentPage > 1 && setCurrentPage((p) => p - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 md:px-4 md:py-2 bg-white border rounded-lg hover:bg-gray-50 text-xs md:text-sm disabled:opacity-50 shadow-sm"
              >
                ◀ 이전
              </button>
              <span className="text-xs md:text-sm text-gray-600 whitespace-nowrap">
                Page{" "}
                <span className="font-bold text-green-600">{currentPage}</span>{" "}
                / {totalPages}
              </span>
              <button
                onClick={() =>
                  currentPage < totalPages && setCurrentPage((p) => p + 1)
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 md:px-4 md:py-2 bg-white border rounded-lg hover:bg-gray-50 text-xs md:text-sm disabled:opacity-50 shadow-sm"
              >
                다음 ▶
              </button>
            </div>
          </>
        )}
      </div>
      {/* ✅ 휴가 상세 모달 반응형 최적화 */}
      {selectedVacation && (
        <VacationModal onClose={() => setSelectedVacation(null)}>
          <div className="flex flex-col gap-6 w-full max-h-[85vh] overflow-y-auto pr-1">
            <h3 className="text-lg md:text-xl font-bold text-gray-800 border-b pb-4 sticky top-0 bg-white z-10">
              ✅ 결재 완료 상세
            </h3>
            {/* 그리드를 모바일 1열, 태블릿 이상 2열로 조정 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div>
                <span className="block text-gray-500 font-bold mb-1 text-xs md:text-sm">
                  신청자
                </span>
                <p className="text-gray-800 font-medium">
                  {selectedVacation.userName}
                </p>
              </div>

              <div className="sm:row-span-2">
                <span className="block text-gray-500 font-bold mb-1 text-xs md:text-sm">
                  결재 상태
                </span>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm">
                  <span
                    className={`inline-block mb-3 px-2 py-0.5 rounded text-[10px] md:text-xs font-bold ${
                      selectedVacation.status.includes("승인")
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {selectedVacation.status}
                  </span>
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

              <div>
                <span className="block text-gray-500 font-bold mb-1 text-xs md:text-sm">
                  기간
                </span>
                <p className="text-gray-800 font-medium break-keep">
                  {selectedVacation.startDate} ~ {selectedVacation.endDate}
                </p>
              </div>

              <div className="sm:col-span-2">
                <span className="block text-gray-500 font-bold mb-1 text-xs md:text-sm">
                  사유
                </span>
                <div className="bg-gray-50 p-4 rounded-lg text-gray-700 leading-relaxed border border-gray-100">
                  {selectedVacation.reason}
                </div>
              </div>
            </div>

            {/* 코멘트 표시 최적화 */}
            {selectedVacation.approvalHistory &&
              selectedVacation.approvalHistory.some((h) => h.comment) && (
                <div className="bg-yellow-50/50 p-3 rounded-lg border border-yellow-100 mt-2">
                  <span className="block text-gray-500 font-bold mb-2 text-xs md:text-sm">
                    결재 의견
                  </span>
                  {selectedVacation.approvalHistory.map(
                    (h, i) =>
                      h.comment && (
                        <div
                          key={i}
                          className="text-xs md:text-sm border-b border-yellow-200 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0"
                        >
                          <span className="font-bold text-gray-800">
                            {h.approver}
                          </span>
                          :{" "}
                          <p className="inline text-gray-700 italic">
                            {h.comment}
                          </p>
                        </div>
                      )
                  )}
                </div>
              )}

            <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => setSelectedVacation(null)}
                className="w-full sm:w-auto px-6 py-2.5 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm font-bold text-gray-700 transition-colors shadow-sm"
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

export default function CompletedApprovalPage() {
  return (
    <Suspense fallback={<div className="p-6">로딩 중...</div>}>
      <CompletedApprovalContent />
    </Suspense>
  );
}
