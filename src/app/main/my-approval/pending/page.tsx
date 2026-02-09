"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Pagination from "@/components/pagination";
import { useState, Suspense } from "react";
import VacationModal from "@/components/vacationModal";
import { useRouter } from "next/navigation";

// ✅ [1] 타입 정의 (Strict Typing)
interface Approvers {
  first?: string[];
  second?: string[];
  third?: string[];
  shared?: string[];
}

interface ApprovalHistoryItem {
  approver: string;
  status: string;
  comment?: string;
  approvedAt: number;
}

interface PendingItem {
  id: string;
  userName: string;
  status: string;
  category: "vacation" | "report" | "approval";
  createdAt: number;

  // 휴가용 필드
  startDate?: string;
  endDate?: string;
  daysUsed?: number;
  reason?: string;
  types?: string | string[];

  // 보고서/품의서용 필드
  title?: string;

  approvers?: Approvers;
  approvalHistory?: ApprovalHistoryItem[];
}

interface PendingApiResponse {
  pending: PendingItem[];
}

// ✅ [2] API 호출 및 데이터 통합 Fetcher
const fetchCombinedPending = async (
  userName: string
): Promise<PendingItem[]> => {
  // 공통 Fetcher 함수
  const fetchList = async (
    url: string,
    category: "vacation" | "report" | "approval"
  ) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approverName: userName }),
    });
    const data: PendingApiResponse = await res.json();
    return (data.pending || []).map((item) => ({
      ...item,
      category,
    }));
  };

  const [vacations, reports, approvals] = await Promise.all([
    fetchList("/api/vacation/pending", "vacation"),
    fetchList("/api/report/pending", "report"),
    fetchList("/api/approvals/pending", "approval"),
  ]);

  const combined = [...vacations, ...reports, ...approvals];
  // 최신순 정렬
  combined.sort((a, b) => b.createdAt - a.createdAt);

  return combined;
};

// ------------------------------------------------------------------
// ✅ [3] 메인 콘텐츠 컴포넌트
// ------------------------------------------------------------------
function PendingApprovalContent() {
  const { userName, role } = useSelector((state: RootState) => state.auth);
  const queryClient = useQueryClient();
  const router = useRouter();

  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState("all");
  const ITEMS_PER_PAGE = 12;

  const [selectedVacation, setSelectedVacation] = useState<PendingItem | null>(
    null
  );
  const [comment, setComment] = useState("");

  const { data: list = [], isLoading } = useQuery<PendingItem[]>({
    queryKey: ["pendingCombined", userName],
    queryFn: () => fetchCombinedPending(userName || ""),
    enabled: !!userName,
    refetchOnMount: true,
  });

  // 승인/반려 Mutation (휴가용)
  const approveMutation = useMutation({
    mutationFn: async ({
      id,
      applicant,
      status,
      comment,
    }: {
      id: string;
      applicant: string;
      status: string;
      comment: string;
    }) => {
      const res = await fetch("/api/vacation/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacationId: id,
          approverName: userName,
          applicantUserName: applicant,
          status,
          comment,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "처리 실패");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      const msg =
        variables.status === "reject" ? "반려되었습니다." : "승인되었습니다.";
      alert(msg);

      // 1️⃣ 현재 페이지(대기 목록) 갱신
      queryClient.invalidateQueries({ queryKey: ["pendingCombined"] });

      // 2️⃣ [추가] 대시보드의 통합 대기 카운트 갱신
      queryClient.invalidateQueries({ queryKey: ["combinedPending"] });

      // 3️⃣ [추가] 대시보드 알림 및 결재 완료 이력 갱신
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["completedHistory"] });

      setSelectedVacation(null);
      setComment("");
    },
    onError: (err) => alert(err.message),
  });

  const handleVacationProcess = (status: "approve" | "reject") => {
    if (!selectedVacation) return;
    const actionName = status === "reject" ? "반려" : "승인";
    if (
      confirm(
        `'${selectedVacation.userName}' 휴가를 ${actionName}하시겠습니까?`
      )
    ) {
      approveMutation.mutate({
        id: selectedVacation.id,
        applicant: selectedVacation.userName,
        status,
        comment,
      });
    }
  };

  const handleItemClick = (item: PendingItem) => {
    if (item.category === "vacation") {
      setSelectedVacation(item);
    } else if (item.category === "report") {
      router.push(`/main/report/${item.id}`);
    } else if (item.category === "approval") {
      router.push(`/main/workoutside/approvals/${item.id}`);
    }
  };

  // ✅ [블록 스타일] 결재 진행 상황 렌더링 헬퍼 (자동 추론 로직 포함)
  const renderProgressBlock = (item: PendingItem) => {
    const history = item.approvalHistory || [];
    const approvers = item.approvers;
    const docStatus = item.status;

    // 단계별 상태 추론 함수
    const getStepStatus = (
      stepName: "1차" | "2차" | "3차",
      stepApprovers?: string[]
    ) => {
      if (!stepApprovers || stepApprovers.length === 0) return null;

      // 1. 히스토리에서 찾기
      const action = history.find((h) => stepApprovers.includes(h.approver));
      if (action) {
        return {
          status: action.status, // "승인", "반려" 등
          approver: action.approver,
          color: action.status.includes("반려")
            ? "bg-red-100 text-red-700 border-red-200"
            : "bg-green-100 text-green-700 border-green-200",
        };
      }

      // 2. 히스토리 없으면 현재 문서 상태로 추론 (Fallback)
      let inferredStatus = "예정";
      let inferredColor = "bg-gray-50 text-gray-400 border-gray-200";

      // 현재 문서가 해당 차수 대기 중이면 -> "대기"
      if (docStatus.includes(`${stepName} 결재 대기`)) {
        inferredStatus = "대기";
        inferredColor =
          "bg-blue-50 text-blue-700 border-blue-200 animate-pulse";
      }
      // 현재 문서가 "다음" 차수 대기 중이면 -> 이전 차수는 "승인"으로 간주
      else {
        const stepOrder = { "1차": 1, "2차": 2, "3차": 3 };
        const currentStepMatch = docStatus.match(/(\d)차/);
        const currentStepNum = currentStepMatch
          ? parseInt(currentStepMatch[1])
          : 0;
        const myStepNum = stepOrder[stepName];

        // "최종 승인 완료" 상태거나, 현재 단계보다 내 단계 번호가 작으면 승인된 것임
        if (docStatus === "최종 승인 완료" || currentStepNum > myStepNum) {
          inferredStatus = "승인";
          inferredColor = "bg-green-100 text-green-700 border-green-200";
        }
      }

      return {
        status: inferredStatus,
        approver: stepApprovers[0], // 대표 결재자 1명 표시
        color: inferredColor,
      };
    };

    const first = getStepStatus("1차", approvers?.first);
    const second = getStepStatus("2차", approvers?.second);
    const third = getStepStatus("3차", approvers?.third);

    return (
      <div className="mt-3 flex flex-wrap gap-2 items-center min-w-0">
        {first && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] md:text-xs whitespace-nowrap ${first.color}`}
          >
            <span className="font-bold">1차:</span>{" "}
            <span>{first.approver}</span> <span>({first.status})</span>
          </div>
        )}
        {second && (
          <span className="text-gray-300 text-xs hidden sm:inline">▶</span>
        )}
        {second && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] md:text-xs whitespace-nowrap ${second.color}`}
          >
            <span className="font-bold">2차:</span>{" "}
            <span>{second.approver}</span> <span>({second.status})</span>
          </div>
        )}
        {third && (
          <span className="text-gray-300 text-xs hidden sm:inline">▶</span>
        )}
        {third && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] md:text-xs whitespace-nowrap ${third.color}`}
          >
            <span className="font-bold">3차:</span>{" "}
            <span>{third.approver}</span> <span>({third.status})</span>
          </div>
        )}
      </div>
    );
  };

  const filteredList = list.filter((item) => {
    if (filterType === "all") return true;
    return item.category === filterType;
  });

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredList.slice(offset, offset + ITEMS_PER_PAGE);

  if (isLoading) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="p-3 md:p-6 w-full min-w-0">
      {" "}
      {/* min-w-0 추가: flex 하위 요소 밀림 방지 */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-6 overflow-hidden">
        {/* 상단 필터 영역: 모바일 세로 배치 대응 */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
          <h2 className="text-xl md:text-2xl font-bold text-red-500 whitespace-nowrap">
            ⏳ 결재 대기함
          </h2>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto border p-2 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-red-200 outline-none cursor-pointer"
          >
            <option value="all">전체 보기</option>
            <option value="vacation">휴가</option>
            <option value="report">보고서</option>
            <option value="approval">품의서</option>
          </select>
        </div>

        {filteredList.length === 0 ? (
          <p className="text-center text-gray-400 py-10">
            대기 중인 결재 문서가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {currentItems.map((item) => {
              const isReportOrApproval =
                item.category === "report" || item.category === "approval";
              const badgeColor =
                item.category === "vacation"
                  ? "bg-orange-100 text-orange-700"
                  : item.category === "report"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-blue-100 text-blue-700";
              const typeName =
                item.category === "vacation"
                  ? "휴가"
                  : item.category === "report"
                  ? "보고서"
                  : "품의서";

              const isMyTurn =
                (item.status === "1차 결재 대기" &&
                  item.approvers?.first?.includes(userName || "")) ||
                (item.status === "2차 결재 대기" &&
                  item.approvers?.second?.includes(userName || "")) ||
                (item.status === "3차 결재 대기" &&
                  item.approvers?.third?.includes(userName || ""));
              const alreadyProcessed = item.approvalHistory?.some(
                (h) => h.approver === userName
              );

              return (
                <li
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="py-4 px-1 md:px-3 hover:bg-red-50 rounded-lg cursor-pointer transition-colors group border-b last:border-0 border-gray-100"
                >
                  <div className="flex justify-between items-start w-full gap-2">
                    <div className="flex-1 min-w-0">
                      {/* 상단 뱃지 및 정보 라인: 텍스트 겹침 방지 */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span
                          className={`text-[10px] md:text-xs font-bold px-2 py-0.5 rounded shrink-0 ${badgeColor}`}
                        >
                          {typeName}
                        </span>

                        {isMyTurn ? (
                          <span className="bg-red-500 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded animate-pulse shrink-0">
                            결재 필요
                          </span>
                        ) : alreadyProcessed ? (
                          <span className="bg-gray-400 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded shrink-0">
                            승인 완료(대기중)
                          </span>
                        ) : item.userName === userName ? (
                          <span className="bg-blue-500 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded shrink-0">
                            기안 문서
                          </span>
                        ) : (
                          <span className="bg-blue-100 text-blue-700 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded shrink-0">
                            {item.status}
                          </span>
                        )}

                        <span className="font-bold text-gray-800 text-sm md:text-base ml-1 truncate max-w-[100px] sm:max-w-none">
                          {item.userName}
                        </span>
                        <span className="text-[10px] md:text-xs text-gray-400 whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* 내용 영역: 말줄임 처리 적용 */}
                      <div className="mt-2 pl-1">
                        {item.category === "vacation" ? (
                          <div className="text-xs md:text-sm text-gray-600">
                            <p className="font-medium">
                              📅 {item.startDate} ~ {item.endDate} (
                              {item.daysUsed}일)
                            </p>
                            <p className="text-[11px] md:text-xs text-gray-400 mt-1 truncate">
                              {item.reason}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm md:text-base font-bold text-gray-800 truncate">
                            📄 {item.title || "제목 없음"}
                          </p>
                        )}
                      </div>

                      {/* 결재선 블록: flex-wrap으로 좁은 화면 대응 */}
                      {isReportOrApproval && renderProgressBlock(item)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* 하단 페이지네이션 간격 조절 */}
        <div className="mt-4">
          <Pagination
            totalItems={filteredList.length}
            itemsPerPage={ITEMS_PER_PAGE}
            currentPage={currentPage}
          />
        </div>
      </div>
      {/* 휴가 모달 반응형 최적화 */}
      {selectedVacation && (
        <VacationModal onClose={() => setSelectedVacation(null)}>
          <div className="flex flex-col gap-5 md:gap-6 w-full max-h-[85vh] overflow-y-auto pr-1">
            <h3 className="text-lg md:text-xl font-bold text-gray-800 border-b pb-4 sticky top-0 bg-white z-10">
              📝 휴가 신청 상세
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 font-bold block mb-1">
                  신청자
                </span>
                <p className="font-medium">{selectedVacation.userName}</p>
              </div>
              <div>
                <span className="text-gray-500 font-bold block mb-1">기간</span>
                <p className="font-medium whitespace-nowrap">
                  {selectedVacation.startDate} ~ {selectedVacation.endDate}
                </p>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <span className="text-gray-500 font-bold block mb-1">사유</span>
                <div className="bg-gray-50 p-3 rounded text-gray-700 min-h-[60px] border border-gray-100 text-xs md:text-sm">
                  {selectedVacation.reason}
                </div>
              </div>
            </div>

            {(role === "admin" || role === "supervisor") &&
              selectedVacation.userName !== userName && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-gray-500 font-bold mb-2 text-xs md:text-sm">
                    결재 의견
                  </label>
                  <textarea
                    className="w-full border p-3 rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-red-100 transition-all"
                    rows={3}
                    placeholder="결재 또는 반려 의견을 입력하세요..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
              )}

            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4 pt-4 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => setSelectedVacation(null)}
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
              {(role === "admin" || role === "supervisor") &&
                selectedVacation.userName !== userName && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleVacationProcess("reject")}
                      className="flex-1 sm:flex-none px-5 py-2.5 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-colors shadow-sm shadow-red-100"
                    >
                      반려
                    </button>
                    <button
                      onClick={() => handleVacationProcess("approve")}
                      className="flex-1 sm:flex-none px-7 py-2.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors shadow-sm shadow-green-100"
                    >
                      승인
                    </button>
                  </div>
                )}
            </div>
          </div>
        </VacationModal>
      )}
    </div>
  );
}

export default function PendingApprovalPage() {
  return (
    <Suspense fallback={<div className="p-6">로딩 중...</div>}>
      <PendingApprovalContent />
    </Suspense>
  );
}
