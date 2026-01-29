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

  if (isLoading && !data) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="p-6 w-full">
      <div className="bg-white border rounded-2xl shadow-sm px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-green-600">✅ 결재 완료함</h2>

          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setCurrentPage(1);
            }}
            className="border p-2 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-green-200 outline-none cursor-pointer"
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
                  className="py-4 px-3 hover:bg-green-50 rounded-lg cursor-pointer transition-colors group"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getCategoryBadge(item)}
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">
                          {item.status}
                        </span>
                        <span className="font-bold text-gray-800">
                          {item.userName}
                        </span>
                      </div>

                      <div className="ml-1">
                        {item.category === "vacation" ? (
                          <div className="text-sm text-gray-600 flex items-center gap-2">
                            <span>
                              {item.startDate} ~ {item.endDate}
                            </span>
                            <span className="text-black text-xs truncate max-w-[400px]">
                              📝 {item.reason}
                            </span>
                          </div>
                        ) : (
                          <>
                            {/* ✅ implementDate가 있으면 표시 */}
                            {item.implementDate && (
                              <div className="text-sm text-gray-600 flex items-center gap-2">
                                <span>{item.implementDate}</span>
                                <span className="text-black  text-xs truncate max-w-[400px]">
                                  {item.title || "제목 없음"}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <span className="text-xs text-green-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      상세보기 →
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {/* 페이지네이션 */}
            <div className="flex justify-center items-center gap-4 mt-6 py-2">
              <button
                onClick={() => currentPage > 1 && setCurrentPage((p) => p - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border rounded hover:bg-gray-50 text-sm disabled:opacity-50"
              >
                ◀ 이전
              </button>
              <span className="text-sm text-gray-600">
                Page{" "}
                <span className="font-bold text-green-600">{currentPage}</span>{" "}
                / {totalPages}
              </span>
              <button
                onClick={() =>
                  currentPage < totalPages && setCurrentPage((p) => p + 1)
                }
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border rounded hover:bg-gray-50 text-sm disabled:opacity-50"
              >
                다음 ▶
              </button>
            </div>
          </>
        )}
      </div>

      {/* ✅ 휴가 상세 모달 */}
      {selectedVacation && (
        <VacationModal onClose={() => setSelectedVacation(null)}>
          <div className="flex flex-col gap-6">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-4">
              ✅ 결재 완료 상세
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-gray-500 font-bold mb-1">
                  신청자
                </span>
                <p className="text-gray-800">{selectedVacation.userName}</p>
              </div>

              <div className="row-span-2">
                <span className="block text-gray-500 font-bold mb-1">상태</span>
                <div className="bg-gray-50 p-3 rounded border border-gray-200">
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
                <span className="block text-gray-500 font-bold mb-1">기간</span>
                <p className="text-gray-800">
                  {selectedVacation.startDate} ~ {selectedVacation.endDate}
                </p>
              </div>
              <div className="col-span-2">
                <span className="block text-gray-500 font-bold mb-1">사유</span>
                <div className="bg-gray-50 p-3 rounded text-gray-700">
                  {selectedVacation.reason}
                </div>
              </div>
            </div>

            {/* 코멘트 표시 */}
            {selectedVacation.approvalHistory &&
              selectedVacation.approvalHistory.some((h) => h.comment) && (
                <div className="bg-yellow-50 p-3 rounded border border-yellow-100 mt-2">
                  {selectedVacation.approvalHistory.map(
                    (h, i) =>
                      h.comment && (
                        <div
                          key={i}
                          className="text-sm border-b border-yellow-200 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0"
                        >
                          <span className="font-bold">{h.approver}</span>:{" "}
                          {h.comment}
                        </div>
                      )
                  )}
                </div>
              )}

            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={() => setSelectedVacation(null)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
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
