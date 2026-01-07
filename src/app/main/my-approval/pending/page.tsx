"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Pagination from "@/components/pagination";
import { useState } from "react";

// ✅ 타입 정의
interface PendingItem {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  status: string;
  category: string;
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

  // ✅ [수정] any 제거 -> Omit 타입 사용
  // API에서 온 데이터는 category가 없으므로 Omit으로 제외하고 타입을 지정
  return (data.pending || []).map((item: Omit<PendingItem, "category">) => ({
    ...item,
    category: "vacation",
  }));
};

export default function PendingApprovalPage() {
  const { userName } = useSelector((state: RootState) => state.auth);
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState("all");
  const ITEMS_PER_PAGE = 15;

  // ✅ 데이터 조회 Hooks
  const { data: list = [], isLoading } = useQuery<PendingItem[]>({
    queryKey: ["pendingVacations", userName],
    queryFn: () => fetchPending(userName!),
    enabled: !!userName,
  });

  // ✅ 결재 승인 Mutation
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

  // 필터링 및 페이징 로직
  const filteredList = list.filter((item) => {
    if (filterType === "all") return true;
    return item.category === filterType;
  });

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredList.slice(offset, offset + ITEMS_PER_PAGE);

  if (isLoading) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="p-6 w-full">
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        {/* 헤더 부분 */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-orange-500">⏳ 결재 대기함</h2>

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
          </select>
        </div>

        {filteredList.length === 0 ? (
          <p className="text-center text-gray-400 py-10">
            대기 중인 결재 문서가 없습니다.
          </p>
        ) : (
          <ul className="divide-y">
            {currentItems.map((item) => (
              <li key={item.id} className="py-4 px-2 hover:bg-gray-50 rounded">
                <div className="flex justify-between items-center">
                  {/* 왼쪽: 정보 영역 */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded">
                        {item.status}
                      </span>
                      <span className="font-bold text-gray-800">
                        {item.userName}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 ml-1 flex flex-col gap-0.5">
                      <span>
                        📅 {item.startDate} ~ {item.endDate} ({item.daysUsed}일)
                      </span>
                      <span className="text-gray-400 text-xs">
                        📝 {item.reason}
                      </span>
                    </div>
                  </div>

                  {/* 오른쪽: 승인 버튼 */}
                  <button
                    onClick={() => handleApprove(item)}
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 bg-[#519d9e] text-white text-sm font-bold rounded-lg hover:bg-[#407f80] transition-colors shadow-sm disabled:bg-gray-300 cursor-pointer"
                  >
                    {approveMutation.isPending ? "처리 중..." : "결재 승인"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* 페이지네이션 */}
        <Pagination
          totalItems={filteredList.length}
          itemsPerPage={ITEMS_PER_PAGE}
          currentPage={currentPage}
          // Pagination 내부 로직에 의해 페이지 변경됨 (현재 컴포넌트엔 setCurrentPage prop이 없는 경우 props 확인 필요)
        />
      </div>
    </div>
  );
}
