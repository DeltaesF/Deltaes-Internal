"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import VacationModal from "@/components/vacationModal";

// ✅ 타입 정의 확장
interface CompletedItem {
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
}

interface CompletedApiResponse {
  list: CompletedItem[];
  totalCount: number;
}

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
  const data = await res.json();
  return data; // API에서 이미 매핑된 데이터를 반환함
};

function CompletedApprovalContent() {
  const { userName } = useSelector((state: RootState) => state.auth);
  const router = useRouter();

  // 상태 관리
  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState("all");
  const ITEMS_PER_PAGE = 15;

  // 모달 상태
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

  // 핸들러
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterType(e.target.value);
    setCurrentPage(1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  // ✅ 클릭 핸들러: 카테고리별 이동 또는 모달
  const handleItemClick = (item: CompletedItem) => {
    if (item.category === "vacation") {
      setSelectedVacation(item);
    } else if (item.category === "report") {
      router.push(`/main/report/${item.id}`);
    } else if (item.category === "approval") {
      router.push(`/main/workoutside/approvals/${item.id}`);
    }
  };

  // 헬퍼: 카테고리 라벨 & 색상
  const getCategoryBadge = (category: string) => {
    switch (category) {
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

  if (isLoading && !data) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="p-6 w-full">
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-green-600">✅ 결재 완료함</h2>

          <select
            value={filterType}
            onChange={handleFilterChange}
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
                  className="py-4 px-2 hover:bg-green-50 rounded cursor-pointer transition-colors group"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {getCategoryBadge(item.category)}
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">
                          {item.status}
                        </span>
                        <span className="font-bold text-gray-800">
                          {item.userName}
                        </span>
                      </div>

                      <div className="text-sm text-gray-500 ml-1">
                        {/* ✅ 카테고리별 표시 내용 분기 */}
                        {item.category === "vacation" ? (
                          <>
                            <span>
                              ({item.startDate} ~ {item.endDate})
                            </span>
                            <span className="text-gray-400 text-xs ml-2 truncate max-w-[300px] inline-block align-bottom">
                              📝 {item.reason}
                            </span>
                          </>
                        ) : (
                          <span className="font-medium text-gray-700">
                            {item.title || "제목 없음"}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-xs text-green-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      상세보기 →
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {/* 페이지네이션 */}
            <div className="flex justify-center items-center gap-4 mt-6 py-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  currentPage === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                    : "bg-white text-gray-700 hover:bg-gray-50 hover:text-green-600 border-gray-300"
                }`}
              >
                ◀ 이전
              </button>

              <span className="text-sm font-medium text-gray-600">
                Page{" "}
                <span className="text-green-600 font-bold">{currentPage}</span>{" "}
                / {totalPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  currentPage === totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                    : "bg-white text-gray-700 hover:bg-gray-50 hover:text-green-600 border-gray-300"
                }`}
              >
                다음 ▶
              </button>
            </div>
          </>
        )}
      </div>

      {/* ✅ 휴가 상세 모달 (VacationModal 재사용) */}
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
              <div>
                <span className="block text-gray-500 font-bold mb-1">상태</span>
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">
                  {selectedVacation.status}
                </span>
              </div>
              <div>
                <span className="block text-gray-500 font-bold mb-1">기간</span>
                <p className="text-gray-800">
                  {selectedVacation.startDate} ~ {selectedVacation.endDate}
                </p>
              </div>
              <div>
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
              <div className="bg-gray-50 p-4 rounded-lg text-gray-700 text-sm min-h-[100px] border">
                {selectedVacation.reason}
              </div>
            </div>

            <div className="flex justify-end mt-4 pt-4 border-t">
              <button
                onClick={() => setSelectedVacation(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm cursor-pointer"
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
