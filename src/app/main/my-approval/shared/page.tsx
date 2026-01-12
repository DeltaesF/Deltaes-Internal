"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useState, Suspense } from "react"; // Pagination import 제거
import { useRouter } from "next/navigation";
import VacationModal from "@/components/vacationModal";

// ✅ 타입 정의
interface NotificationItem {
  id: string;
  fromUserName: string;
  type: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: number;
  vacationId?: string;
}

interface NotificationApiResponse {
  list: NotificationItem[];
  totalCount: number;
}

interface VacationDetail {
  userName: string;
  startDate: string;
  endDate: string;
  status: string;
  daysUsed: number;
  reason: string;
  type: string;
  types?: string[];
}

// ✅ API Fetcher 수정
const fetchNotifications = async (
  userName: string,
  page: number,
  limit: number,
  filterType: string
) => {
  const res = await fetch("/api/notifications/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, page, limit, filterType }),
  });
  if (!res.ok) throw new Error("Fetch failed");
  return res.json();
};

const formatCustomDate = (timestamp: number) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function SharedBoxContent() {
  const { userName } = useSelector(
    (state: RootState) => state.auth || { userName: "사용자" }
  );
  const router = useRouter();

  // ✅ 상태 관리 (URL 파라미터 대신 state 사용 권장)
  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState("all");
  const ITEMS_PER_PAGE = 12;

  const [selectedVacation, setSelectedVacation] =
    useState<VacationDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✅ useQuery (filterType이나 currentPage가 변경되면 자동으로 재호출됨)
  const { data, isLoading } = useQuery<NotificationApiResponse>({
    queryKey: ["notifications", userName, currentPage, filterType],
    queryFn: () =>
      fetchNotifications(userName!, currentPage, ITEMS_PER_PAGE, filterType),
    enabled: !!userName,
    placeholderData: (previousData) => previousData, // 페이지 전환 시 깜빡임 방지
  });

  const list = data?.list || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;

  const typeLabels: Record<string, string> = {
    daily: "일일 업무",
    weekly: "주간 업무",
    report: "보고서",
    approval: "품의서",
    notice: "공지사항",
    resource: "자료실",
    vacation: "휴가원",
    vacation_request: "휴가신청",
    vacation_complete: "휴가승인",
    vacation_reject: "휴가반려",
  };

  const colorClass: Record<string, string> = {
    daily: "bg-blue-100 text-blue-700",
    weekly: "bg-indigo-100 text-indigo-700",
    report: "bg-purple-100 text-purple-700",
    approval: "bg-pink-100 text-pink-700",
    notice: "bg-orange-100 text-orange-700",
    resource: "bg-gray-200 text-gray-700",
    vacation: "bg-red-100 text-red-700",
    vacation_request: "bg-red-100 text-red-700",
    vacation_complete: "bg-green-100 text-green-700",
    vacation_reject: "bg-red-200 text-red-800",
  };

  // ✅ 필터 변경 핸들러
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterType(e.target.value);
    setCurrentPage(1); // 필터 변경 시 1페이지로 리셋
  };

  // ✅ 페이지 변경 핸들러 (이전/다음)
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (item.type.includes("vacation")) {
      if (!item.vacationId) {
        alert("상세 정보를 불러올 수 없습니다. (ID 누락)");
        return;
      }
      try {
        const res = await fetch("/api/vacation/detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vacationId: item.vacationId, // API 수정에 맞춰 파라미터 전달
          }),
        });

        if (!res.ok) throw new Error("Fetch failed");
        const detail = await res.json();

        if (detail.error) {
          alert(detail.error);
          return;
        }

        setSelectedVacation(detail);
        setIsModalOpen(true);
      } catch (e) {
        console.error(e);
        alert("휴가 상세 정보를 불러오는데 실패했습니다.");
      }
    } else {
      router.push(item.link);
    }
  };

  if (isLoading && !data)
    return <div className="p-6 text-gray-500">로딩 중...</div>;

  return (
    <div className="p-6 w-full">
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-purple-600">📭 수신/공유함</h2>
          <select
            value={filterType}
            onChange={handleFilterChange}
            className="border p-2 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-purple-200 outline-none cursor-pointer"
          >
            <option value="all">전체 보기</option>
            <option value="daily">일일 업무</option>
            <option value="weekly">주간 업무</option>
            <option value="approval">품의서</option>
            <option value="report">보고서</option>
            <option value="vacation">휴가</option>
            <option value="notice">공지사항</option>
            <option value="resource">자료실</option>
          </select>
        </div>

        {list.length === 0 ? (
          <p className="text-center text-gray-400 py-10">내역이 없습니다.</p>
        ) : (
          <>
            <ul className="divide-y">
              {list.map((item) => (
                <li
                  key={item.id}
                  className="py-3 px-2 hover:bg-gray-50 rounded group cursor-pointer"
                  onClick={() => handleItemClick(item)}
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 text-xs font-bold rounded ${
                          colorClass[item.type] || "bg-gray-200"
                        }`}
                      >
                        {typeLabels[item.type] || item.type}
                      </span>
                      <div>
                        <p className="text-gray-800 font-medium group-hover:text-purple-600 transition-colors">
                          {item.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <span>보낸사람: {item.fromUserName}</span>
                          <span className="text-gray-300">|</span>
                          <span className="text-gray-500">
                            {formatCustomDate(item.createdAt)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {item.type.includes("vacation") ? "상세보기" : "바로가기"}{" "}
                      &gt;
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {/* ✅ [수정] 직접 구현한 페이지네이션 UI */}
            <div className="flex justify-center items-center gap-4 mt-6">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  currentPage === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50 hover:text-purple-600"
                }`}
              >
                ◀ 이전
              </button>

              <span className="text-sm font-medium text-gray-600">
                Page{" "}
                <span className="text-purple-600 font-bold">{currentPage}</span>{" "}
                / {totalPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  currentPage === totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50 hover:text-purple-600"
                }`}
              >
                다음 ▶
              </button>
            </div>
          </>
        )}
      </div>

      {/* ✅ 휴가 상세 모달 (기존 코드 유지) */}
      {isModalOpen && selectedVacation && (
        <VacationModal onClose={() => setIsModalOpen(false)}>
          <div className="flex flex-col gap-6">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-4">
              ✅ 휴가 상세 정보
            </h3>
            {/* ... 상세 정보 표시 내용 (기존과 동일) ... */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-gray-500 font-bold mb-1">
                  신청자
                </span>
                <p className="text-gray-800">{selectedVacation.userName}</p>
              </div>
              <div>
                <span className="block text-gray-500 font-bold mb-1">상태</span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700">
                  {selectedVacation.status}
                </span>
              </div>
              <div className="col-span-2">
                <span className="block text-gray-500 font-bold mb-1">기간</span>
                <p className="text-gray-800">
                  {selectedVacation.startDate} ~ {selectedVacation.endDate} (
                  {selectedVacation.daysUsed}일)
                </p>
              </div>
              <div className="col-span-2">
                <span className="block text-gray-500 font-bold mb-1">종류</span>
                <p className="text-gray-800">
                  {Array.isArray(selectedVacation.types) &&
                  selectedVacation.types.length > 0
                    ? selectedVacation.types.join(", ")
                    : selectedVacation.type}
                </p>
              </div>
            </div>
            <div>
              <span className="block text-gray-500 font-bold mb-2">사유</span>
              <div className="bg-gray-50 p-4 rounded-lg text-gray-700 text-sm min-h-[80px] border">
                {selectedVacation.reason}
              </div>
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t">
              <button
                onClick={() => setIsModalOpen(false)}
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

export default function SharedBoxPage() {
  return (
    <Suspense fallback={<div className="p-6">페이지 로딩 중...</div>}>
      <SharedBoxContent />
    </Suspense>
  );
}
