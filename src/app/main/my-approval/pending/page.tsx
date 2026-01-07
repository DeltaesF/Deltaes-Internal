"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Pagination from "@/components/pagination";
import { useState, Suspense } from "react";

// ✅ 타입 정의
interface PendingItem {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  status: string;
  category: string; // 필터링 기준 (vacation, daily, report ...)
  daysUsed: number;
  reason: string;
}

// ✅ 대기 문서 조회 Fetcher
const fetchPending = async (userName: string) => {
  const res = await fetch("/api/vacation/pending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approverName: userName }),
  });
  const data = await res.json();

  // API 데이터 매핑 (category: 'vacation'으로 고정, 추후 다른 문서 추가 시 변경 가능)
  return (data.pending || []).map((item: Omit<PendingItem, "category">) => ({
    ...item,
    category: "vacation",
  }));
};

// ------------------------------------------------------------------
// ✅ [1] Content 컴포넌트
// ------------------------------------------------------------------
function PendingApprovalContent() {
  // ✅ role 추가 가져오기
  const { userName, role } = useSelector((state: RootState) => state.auth);
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState("all");
  const ITEMS_PER_PAGE = 15;

  const { data: list = [], isLoading } = useQuery<PendingItem[]>({
    queryKey: ["pendingVacations", userName],
    queryFn: () => fetchPending(userName!),
    enabled: !!userName,
  });

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
          approverName: userName,
          applicantUserName: applicant,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "승인 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      alert("결재가 승인되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["pendingVacations"] });
    },
    onError: (err) => alert(err.message),
  });

  const handleApprove = (item: PendingItem) => {
    if (confirm(`'${item.userName}'님의 휴가를 승인하시겠습니까?`)) {
      approveMutation.mutate({ id: item.id, applicant: item.userName });
    }
  };

  // ✅ 필터링 로직
  const filteredList = list.filter((item) => {
    if (filterType === "all") return true;
    return item.category === filterType;
  });

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredList.slice(offset, offset + ITEMS_PER_PAGE);

  if (isLoading) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="p-6 w-full">
      <div className="bg-white border rounded-2xl shadow-sm p-4">
        {/* 헤더 부분 */}
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-2xl font-bold text-orange-500">⏳ 결재 대기함</h2>

          {/* 필터 옵션 */}
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setCurrentPage(1);
            }}
            className="border p-2 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-orange-200 outline-none cursor-pointer"
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

        {filteredList.length === 0 ? (
          <p className="text-center text-gray-400 py-10">
            대기 중인 결재 문서가 없습니다.
          </p>
        ) : (
          <ul className="divide-y">
            {currentItems.map((item) => {
              // ✅ 본인 신청 건인지 확인
              const isMyRequest = item.userName === userName;
              // ✅ 결재 권한이 있는지 확인 (user는 권한 없음, 본인 글은 결재 불가)
              const canApprove = role !== "user" && !isMyRequest;

              return (
                <li
                  key={item.id}
                  className="py-3 px-3 hover:bg-gray-50 rounded"
                >
                  <div className="flex justify-between items-center">
                    {/* 왼쪽 정보 영역 */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800">
                          {item.userName}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 ml-1 flex flex-col gap-0.5">
                        <span>
                          📅 {item.startDate} ~ {item.endDate} ({item.daysUsed}
                          일)
                        </span>
                        <span className="text-gray-400 text-xs">
                          📝 {item.reason}
                        </span>
                      </div>
                    </div>

                    {/* ✅ 오른쪽 영역: 승인 버튼 OR 상태 텍스트 */}
                    {canApprove ? (
                      <button
                        onClick={() => handleApprove(item)}
                        disabled={approveMutation.isPending}
                        className="px-4 py-2 bg-[#519d9e] text-white text-sm font-bold rounded-lg hover:bg-[#407f80] transition-colors shadow-sm disabled:bg-gray-300 cursor-pointer"
                      >
                        {approveMutation.isPending ? "처리 중..." : "결재 승인"}
                      </button>
                    ) : (
                      // 결재 권한이 없거나 본인 글인 경우 -> 상태 표시
                      <span className="px-4 py-2 text-gray-500 text-sm font-bold bg-gray-100 rounded-lg border border-gray-200">
                        {item.status}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination
          totalItems={filteredList.length}
          itemsPerPage={ITEMS_PER_PAGE}
          currentPage={currentPage}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// ✅ [2] Page 컴포넌트 (Suspense 적용)
// ------------------------------------------------------------------
export default function PendingApprovalPage() {
  return (
    <Suspense fallback={<div className="p-6">로딩 중...</div>}>
      <PendingApprovalContent />
    </Suspense>
  );
}
