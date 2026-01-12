"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Pagination from "@/components/pagination";
import { useState, Suspense } from "react";
import VacationModal from "@/components/vacationModal"; // ✅ 모달 컴포넌트 임포트

// ✅ 타입 정의 (상세 정보 포함)
interface PendingItem {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  status: string;
  category: string;
  daysUsed: number;
  reason: string;
  types: string | string[]; // 휴가 종류 추가
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
    approvedAt: { seconds: number } | string;
  }[];
}

// ✅ 대기 문서 조회 Fetcher
const fetchPending = async (userName: string) => {
  const res = await fetch("/api/vacation/pending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approverName: userName }),
  });
  const data = await res.json();

  // API 데이터 매핑
  return (data.pending || []).map((item: Omit<PendingItem, "category">) => ({
    ...item,
    category: "vacation",
  }));
};

// ------------------------------------------------------------------
// ✅ [1] Content 컴포넌트
// ------------------------------------------------------------------
function PendingApprovalContent() {
  // ✅ role 가져오기 (권한 체크용)
  const { userName, role } = useSelector((state: RootState) => state.auth);
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState("all");
  const ITEMS_PER_PAGE = 15;

  // ✅ 선택된 항목 상태 (모달용)
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);

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
      setSelectedItem(null); // 승인 후 모달 닫기
    },
    onError: (err) => alert(err.message),
  });

  const handleApprove = () => {
    if (!selectedItem) return;
    if (confirm(`'${selectedItem.userName}'님의 휴가를 승인하시겠습니까?`)) {
      approveMutation.mutate({
        id: selectedItem.id,
        applicant: selectedItem.userName,
      });
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
            {currentItems.map((item) => (
              <li
                key={item.id}
                onClick={() => setSelectedItem(item)} // ✅ 클릭 시 모달 열기
                className="py-4 px-2 hover:bg-orange-50 rounded cursor-pointer transition-colors group"
              >
                <div className="flex justify-between items-center">
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
                      <span className="text-gray-400 text-xs truncate max-w-[300px]">
                        📝 {item.reason}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-orange-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    상세보기 →
                  </span>
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

      {/* ✅ 상세 모달 (VacationModal 재사용) */}
      {selectedItem && (
        <VacationModal onClose={() => setSelectedItem(null)}>
          <div className="flex flex-col gap-6">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-4">
              📝 휴가 신청 상세
            </h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-gray-500 font-bold mb-1">
                  신청자
                </span>
                <p className="text-gray-800">{selectedItem.userName}</p>
              </div>
              <div>
                <span className="block text-gray-500 font-bold mb-1">상태</span>
                <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-bold">
                  {selectedItem.status}
                </span>
              </div>
              <div>
                <span className="block text-gray-500 font-bold mb-1">기간</span>
                <p className="text-gray-800">
                  {selectedItem.startDate} ~ {selectedItem.endDate}
                </p>
              </div>
              <div>
                <span className="block text-gray-500 font-bold mb-1">
                  사용일수
                </span>
                <p className="text-gray-800">{selectedItem.daysUsed}일</p>
              </div>
              <div className="col-span-2">
                <span className="block text-gray-500 font-bold mb-1">종류</span>
                <p className="text-gray-800">
                  {Array.isArray(selectedItem.types)
                    ? selectedItem.types.join(", ")
                    : selectedItem.types}
                </p>
              </div>
            </div>

            <div>
              <span className="block text-gray-500 font-bold mb-2">사유</span>
              <div className="bg-gray-50 p-4 rounded-lg text-gray-700 text-sm min-h-[100px] border">
                {selectedItem.reason}
              </div>
            </div>

            {/* ✅ 하단 버튼 영역 */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm cursor-pointer"
              >
                닫기
              </button>

              {/* 🚀 권한 체크: admin/supervisor 이고, 타인의 신청 건일 때만 승인 버튼 노출 */}
              {(role === "admin" || role === "supervisor") &&
                selectedItem.userName !== userName && (
                  <button
                    onClick={handleApprove}
                    disabled={approveMutation.isPending}
                    className="px-6 py-2 bg-[#519d9e] text-white rounded-lg hover:bg-[#407f80] transition-colors font-bold text-sm shadow-md disabled:bg-gray-400 cursor-pointer"
                  >
                    {approveMutation.isPending ? "처리 중..." : "결재 승인"}
                  </button>
                )}
            </div>
          </div>
        </VacationModal>
      )}
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
