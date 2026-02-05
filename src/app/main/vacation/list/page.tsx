"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import VacationModal from "@/components/vacationModal";

// ✅ 타입 정의
interface VacationResponse {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  types: string;
  status: string;
  daysUsed: number;
  reason?: string;
  createdAt: number;
  approvers: {
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

interface VacationApiResponse {
  list: VacationResponse[];
  totalCount: number;
}

// ✅ API 호출 (페이지네이션)
const fetchMyVacations = async (
  userDocId: string,
  page: number,
  limit: number
) => {
  const res = await fetch(`/api/vacation/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: "user",
      userName: userDocId,
      page,
      limit,
    }),
  });
  if (!res.ok) throw new Error("Failed to fetch vacations");
  return res.json();
};

// ✅ 날짜 포맷 헬퍼
const formatDate = (timestamp: number | undefined) => {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function VacationListContent() {
  const { userDocId } = useSelector((state: RootState) => state.auth);
  const router = useRouter();
  const queryClient = useQueryClient();

  // ✅ 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8; // 요청하신 대로 8개

  const [selectedVacation, setSelectedVacation] =
    useState<VacationResponse | null>(null);

  const { data, isLoading } = useQuery<VacationApiResponse>({
    queryKey: ["vacations", userDocId, currentPage],
    queryFn: () => fetchMyVacations(userDocId!, currentPage, ITEMS_PER_PAGE),
    enabled: !!userDocId,
    placeholderData: (prev) => prev,
    refetchOnMount: true,
  });

  const list = data?.list || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;

  // 취소 Mutation
  const cancelMutation = useMutation({
    mutationFn: async (vacationId: string) => {
      const res = await fetch("/api/vacation/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vacationId, applicantUserName: userDocId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "취소 실패");
    },
    onSuccess: () => {
      alert("휴가 요청이 취소되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["vacations"] });
      setSelectedVacation(null);
    },
    onError: (err) => alert(err.message),
  });

  const handleCancel = (id: string) => {
    if (confirm("정말 취소하시겠습니까?")) cancelMutation.mutate(id);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  // ✅ 결재 라인 렌더링 헬퍼
  const renderApprovalLine = (item: VacationResponse) => {
    const history = item.approvalHistory || [];
    const renderRow = (approvers: string[] = [], stepName: string) => {
      if (!approvers.length) return null;
      return approvers.map((name) => {
        const h = history.find((h) => h.approver === name);
        return (
          <div
            key={`${stepName}-${name}`}
            className="flex justify-between items-center text-xs border-b border-dashed border-gray-200 py-1 last:border-0"
          >
            <div className="flex items-center gap-1">
              <span className="text-gray-400 font-normal">[{stepName}]</span>
              <span className="font-semibold text-gray-700">{name}</span>
            </div>
            {h ? (
              <span
                className={`font-bold ${
                  h.status === "반려" ? "text-red-600" : "text-green-600"
                }`}
              >
                [{h.status}] {formatDate(h.approvedAt)}
              </span>
            ) : (
              <span className="text-gray-400">[대기]</span>
            )}
          </div>
        );
      });
    };

    return (
      <div className="mt-2 pt-3 border-t border-dashed">
        <span className="text-xs font-bold text-gray-400 block mb-2">
          결재 진행 내역
        </span>
        <div className="flex flex-col gap-1">
          {renderRow(item.approvers?.first, "1차")}
          {renderRow(item.approvers?.second, "2차")}
          {renderRow(item.approvers?.third, "3차")}
        </div>
      </div>
    );
  };

  if (isLoading && !data)
    return <div className="p-10 text-center">로딩 중...</div>;

  return (
    <div className="flex flex-col w-full p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="px-3 py-1.5 border rounded-lg hover:bg-gray-100 text-sm font-medium text-gray-600 cursor-pointer"
        >
          ◀ 뒤로가기
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          📋 나의 휴가 사용 내역
        </h2>
      </div>

      <div className="bg-white border rounded-xl shadow-sm p-6">
        {list.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            신청한 휴가 내역이 없습니다.
          </div>
        ) : (
          <>
            <div className="divide-y">
              {list.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedVacation(item)}
                  className="p-3 hover:bg-gray-50 transition-colors cursor-pointer rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded text-xs font-bold ${
                          item.status === "최종 승인 완료"
                            ? "bg-green-100 text-green-700"
                            : item.status.includes("반려")
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {item.status}
                      </span>
                      <h3 className="text-lg font-bold text-gray-800">
                        {item.types}{" "}
                        <span className="text-sm font-normal text-gray-500">
                          ({item.daysUsed}일)
                        </span>
                      </h3>
                    </div>

                    {item.status.includes("대기") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(item.id);
                        }}
                        className="px-3 py-1 bg-white border border-red-200 text-red-500 text-xs font-bold rounded hover:bg-red-50 transition-colors"
                      >
                        취소
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg mt-2">
                    <div>
                      <span className="block text-xs font-bold text-gray-400 mb-1">
                        기간
                      </span>
                      <p className="font-medium text-gray-800">
                        {item.startDate} ~ {item.endDate}
                      </p>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-gray-400 mb-1">
                        사유
                      </span>
                      <p className="text-gray-700 truncate">
                        {item.reason || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ✅ 페이지네이션 버튼 */}
            <div className="flex justify-center items-center gap-4 mt-2 py-2 border-t pt-4">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  currentPage === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                    : "bg-white text-gray-700 hover:bg-gray-50 hover:text-blue-600 border-gray-300"
                }`}
              >
                ◀ 이전
              </button>

              <span className="text-sm font-medium text-gray-600">
                Page{" "}
                <span className="text-blue-600 font-bold">{currentPage}</span> /{" "}
                {totalPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  currentPage === totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                    : "bg-white text-gray-700 hover:bg-gray-50 hover:text-blue-600 border-gray-300"
                }`}
              >
                다음 ▶
              </button>
            </div>
          </>
        )}
      </div>

      {/* ✅ 상세 모달 */}
      {selectedVacation && (
        <VacationModal onClose={() => setSelectedVacation(null)}>
          <div className="flex flex-col gap-6">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-4">
              📝 휴가 신청 상세
            </h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2 row-span-2 sm:col-span-1">
                <span className="block text-gray-500 font-bold mb-1">상태</span>
                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <span
                    className={`inline-block mb-2 px-2 py-0.5 rounded text-xs font-bold ${
                      selectedVacation.status === "최종 승인 완료"
                        ? "bg-green-100 text-green-700"
                        : selectedVacation.status.includes("반려")
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {selectedVacation.status}
                  </span>
                  {renderApprovalLine(selectedVacation)}
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <span className="block text-gray-500 font-bold mb-1">기간</span>
                <p className="text-gray-800">
                  {selectedVacation.startDate} ~ {selectedVacation.endDate}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="block text-gray-500 font-bold mb-1">
                  사용일수
                </span>
                <p className="text-gray-800">{selectedVacation.daysUsed}일</p>
              </div>
              <div className="col-span-2">
                <span className="block text-gray-500 font-bold mb-1">종류</span>
                <p className="text-gray-800">
                  {Array.isArray(selectedVacation.types)
                    ? selectedVacation.types.join(", ")
                    : selectedVacation.types}
                </p>
              </div>
            </div>

            <div>
              <span className="block text-gray-500 font-bold mb-2">사유</span>
              <div className="bg-gray-50 p-4 rounded-lg text-gray-700 text-sm min-h-[80px] border">
                {selectedVacation.reason || "내용 없음"}
              </div>
            </div>

            {/* 결재 의견(코멘트) */}
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
                              {formatDate(history.approvedAt)}
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

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              {selectedVacation.status.includes("대기") && (
                <button
                  onClick={() => handleCancel(selectedVacation.id)}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm"
                >
                  신청 취소
                </button>
              )}
              <button
                onClick={() => setSelectedVacation(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
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

export default function VacationListPage() {
  return (
    <Suspense fallback={<div className="p-6">로딩 중...</div>}>
      <VacationListContent />
    </Suspense>
  );
}
