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

interface PendingItem {
  id: string;
  userName: string;
  status: string;
  category: "vacation" | "report" | "approval";
  createdAt: number;

  // 휴가용 (Optional)
  startDate?: string;
  endDate?: string;
  daysUsed?: number;
  reason?: string;
  types?: string | string[];

  // 보고서/품의서용 (Optional)
  title?: string;

  approvers?: Approvers;
}

// ✅ [2] API 호출 및 데이터 통합
const fetchCombinedPending = async (
  userName: string
): Promise<PendingItem[]> => {
  // 1. 휴가
  const fetchVacations = fetch("/api/vacation/pending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approverName: userName }),
  }).then(async (res) => {
    const data = await res.json();
    return (data.pending || []).map((item: Partial<PendingItem>) => ({
      ...item,
      category: "vacation",
    })) as PendingItem[];
  });

  // 2. 보고서
  const fetchReports = fetch("/api/report/pending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approverName: userName }),
  }).then(async (res) => {
    const data = await res.json();
    return (data.pending || []).map((item: Partial<PendingItem>) => ({
      ...item,
      category: "report",
    })) as PendingItem[];
  });

  // 3. 품의서
  const fetchApprovals = fetch("/api/approvals/pending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approverName: userName }),
  }).then(async (res) => {
    const data = await res.json();
    return (data.pending || []).map((item: Partial<PendingItem>) => ({
      ...item,
      category: "approval",
    })) as PendingItem[];
  });

  const [vacations, reports, approvals] = await Promise.all([
    fetchVacations,
    fetchReports,
    fetchApprovals,
  ]);

  const combined = [...vacations, ...reports, ...approvals];
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
  });

  // 휴가 승인/반려 Mutation
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
      queryClient.invalidateQueries({ queryKey: ["pendingCombined"] });
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
        `'${selectedVacation.userName}'님의 휴가를 ${actionName}하시겠습니까?`
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

  const filteredList = list.filter((item) => {
    if (filterType === "all") return true;
    return item.category === filterType;
  });

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredList.slice(offset, offset + ITEMS_PER_PAGE);

  if (isLoading) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="p-6 w-full">
      <div className="bg-white border rounded-2xl shadow-sm px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-red-500">⏳ 결재 대기함</h2>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setCurrentPage(1);
            }}
            className="border p-2 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-red-200 outline-none cursor-pointer"
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
          <ul className="divide-y">
            {currentItems.map((item) => (
              <li
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="py-4 px-3 hover:bg-red-50 rounded-lg cursor-pointer transition-colors group"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          item.category === "vacation"
                            ? "bg-orange-100 text-orange-700"
                            : item.category === "report"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {item.category === "vacation"
                          ? "휴가"
                          : item.category === "report"
                          ? "보고서"
                          : "품의서"}
                      </span>
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded">
                        {item.status}
                      </span>
                      <span className="font-bold text-gray-800">
                        {item.userName}
                      </span>
                    </div>

                    <div className="ml-1">
                      {item.category === "vacation" ? (
                        <div className="text-sm text-gray-600 flex flex-col gap-0.5">
                          <span>
                            📅 {item.startDate} ~ {item.endDate} (
                            {item.daysUsed}일)
                          </span>
                          <span className="text-gray-400 text-xs truncate max-w-[400px]">
                            📝 {item.reason}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-800 font-medium truncate">
                          📄 {item.title || "제목 없음"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ✅ [수정] 버튼 항상 보임 (opacity 제거) */}
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          totalItems={filteredList.length}
          itemsPerPage={ITEMS_PER_PAGE}
          currentPage={currentPage}
        />
      </div>

      {/* ✅ 휴가 모달 */}
      {selectedVacation && (
        <VacationModal onClose={() => setSelectedVacation(null)}>
          <div className="flex flex-col gap-6">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-4">
              📝 휴가 신청 상세
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 font-bold block mb-1">
                  신청자
                </span>
                <span className="text-gray-800">
                  {selectedVacation.userName}
                </span>
              </div>
              <div>
                <span className="text-gray-500 font-bold block mb-1">기간</span>
                <span className="text-gray-800">
                  {selectedVacation.startDate} ~ {selectedVacation.endDate}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 font-bold block mb-1">사유</span>
                <div className="bg-gray-50 p-3 rounded text-gray-700 min-h-[80px]">
                  {selectedVacation.reason}
                </div>
              </div>
            </div>

            {(role === "admin" || role === "supervisor") &&
              selectedVacation.userName !== userName && (
                <div>
                  <label className="block text-gray-500 font-bold mb-2 text-sm">
                    결재 의견 (선택)
                  </label>
                  <textarea
                    className="w-full border p-3 rounded-lg text-sm resize-none focus:ring-2 focus:ring-red-200 outline-none"
                    placeholder="반려 사유 또는 코멘트를 입력하세요."
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
              )}

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <button
                onClick={() => setSelectedVacation(null)}
                className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300"
              >
                닫기
              </button>

              {(role === "admin" || role === "supervisor") &&
                selectedVacation.userName !== userName && (
                  <>
                    <button
                      onClick={() => handleVacationProcess("reject")}
                      disabled={approveMutation.isPending}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 disabled:bg-gray-400"
                    >
                      반려
                    </button>
                    <button
                      onClick={() => handleVacationProcess("approve")}
                      disabled={approveMutation.isPending}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:bg-gray-400"
                    >
                      승인
                    </button>
                  </>
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
