"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Pagination from "@/components/pagination";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import VacationModal from "@/components/vacationModal"; // ✅ 모달 추가

// ✅ 타입 정의
interface NotificationItem {
  id: string;
  fromUserName: string;
  type: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: number;
  vacationId?: string; // ✅ 휴가 ID (알림에 포함되어 있어야 함)
}

// ✅ 모달에 표시할 상세 데이터 타입
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

const fetchNotifications = async (userName: string) => {
  const res = await fetch("/api/notifications/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName }),
  });
  const data = await res.json();
  return data.list || [];
};

// 날짜 포맷 변환 함수
const formatCustomDate = (timestamp: number) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const hours = date.getHours();
  const minutes = date.getMinutes();

  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return `${year}년 ${month}월 ${day}일 ${ampm} ${hour12}시 ${minutes}분`;
};

function SharedBoxContent() {
  const { userName } = useSelector(
    (state: RootState) => state.auth || { userName: "사용자" }
  );
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentPage = Number(searchParams.get("page")) || 1;
  const [filterType, setFilterType] = useState("all");
  const ITEMS_PER_PAGE = 12;

  // ✅ 모달 상태 관리
  const [selectedVacation, setSelectedVacation] =
    useState<VacationDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: list = [], isLoading } = useQuery<NotificationItem[]>({
    queryKey: ["notifications", userName],
    queryFn: () => fetchNotifications(userName!),
    enabled: !!userName,
  });

  // 🔹 필터링 로직
  const filteredList = list.filter((item) => {
    if (filterType === "all") return true;
    // 휴가 관련 타입 통합 필터링
    if (filterType === "vacation") {
      return item.type.includes("vacation");
    }
    return item.type === filterType;
  });

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredList.slice(offset, offset + ITEMS_PER_PAGE);

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
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterType(e.target.value);
    router.push("?page=1");
  };

  // ✅ 클릭 핸들러 (휴가는 모달, 나머지는 이동)
  const handleItemClick = async (item: NotificationItem) => {
    if (item.type.includes("vacation")) {
      // 1. 휴가 ID가 없으면 경고 (구버전 데이터일 수 있음)
      if (!item.vacationId) {
        alert("상세 정보를 불러올 수 없습니다. (ID 누락)");
        return;
      }

      // 2. 상세 정보 가져오기
      try {
        const res = await fetch("/api/vacation/detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromUserName: item.fromUserName,
            vacationId: item.vacationId,
          }),
        });

        if (!res.ok) throw new Error("Fetch failed");

        const detail = await res.json();
        setSelectedVacation(detail);
        setIsModalOpen(true);
      } catch (e) {
        console.error(e);
        alert("휴가 상세 정보를 불러오는데 실패했습니다.");
      }
    } else {
      // 3. 다른 항목은 링크 이동
      router.push(item.link);
    }
  };

  if (isLoading) return <div className="p-6">로딩 중...</div>;

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

        {filteredList.length === 0 ? (
          <p className="text-center text-gray-400 py-10">내역이 없습니다.</p>
        ) : (
          <ul className="divide-y">
            {currentItems.map((item) => (
              <li
                key={item.id}
                className="py-3 px-2 hover:bg-gray-50 rounded group cursor-pointer"
                onClick={() => handleItemClick(item)} // ✅ 클릭 이벤트 연결
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
        )}
        <Pagination
          totalItems={filteredList.length}
          itemsPerPage={ITEMS_PER_PAGE}
          currentPage={currentPage}
        />
      </div>

      {/* ✅ 휴가 상세 모달 */}
      {isModalOpen && selectedVacation && (
        <VacationModal onClose={() => setIsModalOpen(false)}>
          <div className="flex flex-col gap-6">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-4">
              ✅ 휴가 상세 정보
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
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    selectedVacation.status.includes("승인")
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
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

// 2️⃣ 메인 페이지 컴포넌트
export default function SharedBoxPage() {
  return (
    <Suspense fallback={<div className="p-6">페이지 로딩 중...</div>}>
      <SharedBoxContent />
    </Suspense>
  );
}
