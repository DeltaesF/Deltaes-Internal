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
  attachments?: { name: string; url: string }[];
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

  // ✅ 결재 라인 렌더링 헬퍼 (반응형 대응)
  const renderApprovalLine = (item: VacationResponse) => {
    const history = item.approvalHistory || [];
    const renderRow = (approvers: string[] = [], stepName: string) => {
      if (!approvers.length) return null;
      return approvers.map((name) => {
        const h = history.find((h) => h.approver === name);
        return (
          <div
            key={`${stepName}-${name}`}
            className="flex justify-between items-center text-[11px] md:text-xs border-b border-dashed border-gray-200 py-1.5 last:border-0"
          >
            <div className="flex items-center gap-1">
              <span className="text-gray-400 font-normal">[{stepName}]</span>
              <span className="font-semibold text-gray-700">{name}</span>
            </div>
            {h ? (
              <span
                className={`font-bold whitespace-nowrap ${
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
    <div className="flex flex-col w-full p-4 md:p-6 lg:max-w-5xl mx-auto min-w-0">
      {/* 상단 헤더: 모바일에서 간격 조절 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="w-fit px-3 py-1.5 border rounded-lg hover:bg-gray-100 text-xs md:text-sm font-medium text-gray-600 cursor-pointer transition-colors"
        >
          ◀ 뒤로가기
        </button>
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">
          📋 나의 휴가 사용 내역
        </h2>
      </div>

      <div className="bg-white border rounded-xl shadow-sm p-4 md:p-6 overflow-hidden">
        {list.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">
            신청한 휴가 내역이 없습니다.
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {list.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedVacation(item)}
                  className="py-4 md:p-3 hover:bg-gray-50 transition-colors cursor-pointer rounded-lg group"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:gap-3 flex-1 min-w-0">
                      <span
                        className={`w-fit px-2.5 py-1 rounded text-[10px] md:text-xs font-bold shrink-0 ${
                          item.status === "최종 승인 완료"
                            ? "bg-green-100 text-green-700"
                            : item.status.includes("반려")
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {item.status}
                      </span>
                      <h3 className="text-base md:text-lg font-bold text-gray-800 truncate">
                        {item.types}{" "}
                        <span className="text-xs md:text-sm font-normal text-gray-500">
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
                        className="shrink-0 px-2.5 py-1 bg-white border border-red-200 text-red-500 text-[10px] md:text-xs font-bold rounded hover:bg-red-50 transition-colors"
                      >
                        취소
                      </button>
                    )}
                  </div>

                  {/* 카드 내부 정보: 태블릿 가변 그리드 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mt-3">
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold text-gray-400 mb-0.5">
                        기간
                      </span>
                      <p className="font-medium text-gray-800 break-keep">
                        {item.startDate} ~ {item.endDate}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold text-gray-400 mb-0.5">
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

            {/* 페이지네이션: 터치 대응 간격 확대 */}
            <div className="flex justify-center items-center gap-2 md:gap-4 mt-6 py-2 border-t pt-6">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg border text-xs md:text-sm font-medium transition-colors ${
                  currentPage === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                    : "bg-white text-gray-700 hover:bg-gray-50 hover:text-blue-600 border-gray-300"
                }`}
              >
                ◀ 이전
              </button>

              <span className="text-xs md:text-sm font-medium text-gray-600 whitespace-nowrap px-1">
                Page{" "}
                <span className="text-blue-600 font-bold">{currentPage}</span> /{" "}
                {totalPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg border text-xs md:text-sm font-medium transition-colors ${
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

      {/* ✅ 상세 모달: 내부 콘텐츠 반응형 그리드 적용 */}
      {selectedVacation && (
        <VacationModal onClose={() => setSelectedVacation(null)}>
          <div className="flex flex-col gap-5 md:gap-6 w-full max-h-[80vh] overflow-y-auto pr-1 custom-scrollbar">
            <h3 className="text-lg md:text-xl font-bold text-gray-800 border-b pb-4 sticky top-0 bg-white z-10">
              📝 휴가 신청 상세
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 text-sm">
              <div className="sm:row-span-2">
                <span className="block text-gray-500 font-bold mb-1.5 text-xs md:text-sm">
                  결재 상태
                </span>
                <div className="bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm">
                  <span
                    className={`inline-block mb-3 px-2 py-0.5 rounded text-[10px] md:text-xs font-bold ${
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

              <div>
                <span className="block text-gray-500 font-bold mb-1 text-xs md:text-sm">
                  기간
                </span>
                <p className="text-gray-800 font-medium">
                  {selectedVacation.startDate} ~ {selectedVacation.endDate}
                </p>
              </div>

              <div>
                <span className="block text-gray-500 font-bold mb-1 text-xs md:text-sm">
                  사용일수
                </span>
                <p className="text-gray-800 font-medium">
                  {selectedVacation.daysUsed}일
                </p>
              </div>

              <div className="sm:col-span-1">
                <span className="block text-gray-500 font-bold mb-1 text-xs md:text-sm">
                  종류
                </span>
                <p className="text-gray-800 font-medium">
                  {Array.isArray(selectedVacation.types)
                    ? selectedVacation.types.join(", ")
                    : selectedVacation.types}
                </p>
              </div>
            </div>

            <div>
              <span className="block text-gray-500 font-bold mb-2 text-xs md:text-sm">
                사유
              </span>
              <div className="bg-gray-50 px-4 py-1 rounded-lg text-gray-700 text-sm min-h-[20px] border border-gray-100 leading-relaxed italic">
                {selectedVacation.reason || "내용 없음"}
              </div>
            </div>

            {/* ✅ 증빙 서류(첨부파일) 섹션 추가 */}
            {selectedVacation.attachments &&
              selectedVacation.attachments.length > 0 && (
                <div>
                  <span className="block text-gray-500 font-bold mb-2 text-xs md:text-sm">
                    📎 증빙 서류
                  </span>
                  <div className="flex flex-col gap-2">
                    {selectedVacation.attachments.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors group"
                      >
                        <span className="text-lg">📄</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-800 truncate">
                            {file.name}
                          </p>
                        </div>
                        <span className="text-blue-300 group-hover:text-blue-600 font-bold">
                          →
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

            {/* 결재 의견(코멘트) */}
            {selectedVacation.approvalHistory &&
              selectedVacation.approvalHistory.some((h) => h.comment) && (
                <div>
                  <span className="block text-gray-500 font-bold mb-2 text-xs md:text-sm">
                    결재 의견
                  </span>
                  <div className="bg-yellow-50/50 p-3 md:p-4 rounded-xl border border-yellow-100 flex flex-col gap-3">
                    {selectedVacation.approvalHistory.map((history, idx) =>
                      history.comment ? (
                        <div
                          key={idx}
                          className="text-xs md:text-sm border-b border-yellow-100 last:border-0 pb-3 last:pb-0"
                        >
                          <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
                            <span className="font-bold text-gray-800">
                              {history.approver}
                              <span
                                className={`ml-1 text-[10px] md:text-xs ${
                                  history.status === "반려"
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                ({history.status})
                              </span>
                            </span>
                            <span className="text-[10px] text-gray-500 font-normal">
                              {formatDate(history.approvedAt)}
                            </span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap italic">
                            {history.comment}
                          </p>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4 pt-4 border-t sticky bottom-0 bg-white">
              {selectedVacation.status.includes("대기") && (
                <button
                  onClick={() => handleCancel(selectedVacation.id)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-bold text-sm shadow-sm"
                >
                  신청 취소
                </button>
              )}
              <button
                onClick={() => setSelectedVacation(null)}
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-bold text-sm"
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
