"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Pagination from "@/components/pagination";
import { useState, Suspense } from "react";
import VacationModal from "@/components/vacationModal"; // ✅ 모달 컴포넌트 임포트

// ✅ 타입 정의 (상세 정보 필드 추가)
interface CompletedItem {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  status: string;
  category: string;
  daysUsed: number;
  reason: string;
  types: string | string[]; // 휴가 종류
}

const fetchCompleted = async (userName: string) => {
  const res = await fetch("/api/vacation/approve-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName }),
  });
  const data = await res.json();

  // API 데이터 매핑 (category: 'vacation' 고정)
  return (data.list || []).map((item: Omit<CompletedItem, "category">) => ({
    ...item,
    category: "vacation",
  }));
};

// ------------------------------------------------------------------
// ✅ [1] Content 컴포넌트
// ------------------------------------------------------------------
function CompletedApprovalContent() {
  const { userName } = useSelector((state: RootState) => state.auth);

  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState("all");
  const ITEMS_PER_PAGE = 15;

  // ✅ 선택된 항목 상태 (모달용)
  const [selectedItem, setSelectedItem] = useState<CompletedItem | null>(null);

  const { data: list = [], isLoading } = useQuery<CompletedItem[]>({
    queryKey: ["completedHistory", userName],
    queryFn: () => fetchCompleted(userName!),
    enabled: !!userName,
  });

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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-green-600">✅ 결재 완료함</h2>

          {/* 필터 옵션 */}
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
            완료된 결재 내역이 없습니다.
          </p>
        ) : (
          <ul className="divide-y">
            {currentItems.map((item) => (
              <li
                key={item.id}
                onClick={() => setSelectedItem(item)} // ✅ 클릭 시 모달 열기
                className="py-4 px-2 hover:bg-green-50 rounded cursor-pointer transition-colors group"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">
                        {item.status}
                      </span>
                      <span className="font-bold text-gray-800">
                        {item.userName}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 ml-1">
                      <span>
                        ({item.startDate} ~ {item.endDate})
                      </span>
                      {/* 사유 간략히 보기 */}
                      <span className="text-gray-400 text-xs ml-2 truncate max-w-[300px] inline-block align-bottom">
                        📝 {item.reason}
                      </span>
                    </div>
                  </div>
                  {/* 상세보기 텍스트 (호버 시 표시) */}
                  <span className="text-xs text-green-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
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
              ✅ 결재 완료 상세
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
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">
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

            <div className="flex justify-end mt-4 pt-4 border-t">
              <button
                onClick={() => setSelectedItem(null)}
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

// ------------------------------------------------------------------
// ✅ [2] Page 컴포넌트 (Suspense 적용)
// ------------------------------------------------------------------
export default function CompletedApprovalPage() {
  return (
    <Suspense fallback={<div className="p-6">로딩 중...</div>}>
      <CompletedApprovalContent />
    </Suspense>
  );
}
