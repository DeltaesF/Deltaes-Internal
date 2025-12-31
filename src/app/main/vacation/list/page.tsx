"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";

// ✅ Firestore 타임스탬프 타입 정의
interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

// ✅ 휴가 데이터 타입 정의
interface VacationResponse {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  types: string;
  status: string;
  daysUsed: number;
  reason?: string;
  approvalHistory?: {
    approver: string;
    status: string;
    approvedAt: string | FirestoreTimestamp;
  }[];
}

const fetchMyVacations = async (userDocId: string) => {
  const res = await fetch(`/api/vacation/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "user", userName: userDocId }),
  });
  const data = await res.json();
  // 최신순 정렬
  return ((data.list as VacationResponse[]) || []).sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
};

export default function MyVacationHistoryPage() {
  const { userDocId } = useSelector((state: RootState) => state.auth);
  const router = useRouter();
  const queryClient = useQueryClient();

  // 🔹 무한 스크롤을 위한 상태
  const [visibleCount, setVisibleCount] = useState(5); // 처음에 4개 보여줌
  const LOAD_MORE_COUNT = 5; // 스크롤 시 4개씩 추가
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // 데이터 조회
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["vacations", "my_full", userDocId],
    queryFn: () => fetchMyVacations(userDocId!),
    enabled: !!userDocId,
  });

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
    },
    onError: (err) => alert(err.message),
  });

  const handleCancel = (id: string) => {
    if (confirm("정말 취소하시겠습니까?")) cancelMutation.mutate(id);
  };

  // ✅ [수정] any 타입 오류 해결: 타입을 구체적으로 명시
  const formatDate = (
    dateValue: string | number | Date | FirestoreTimestamp | null | undefined
  ) => {
    if (!dateValue) return "-";

    let date: Date;
    if (typeof dateValue === "object" && "seconds" in dateValue) {
      // Firestore Timestamp 처리
      date = new Date(dateValue.seconds * 1000);
    } else {
      // string | number | Date 처리
      date = new Date(dateValue as string | number | Date);
    }

    return date.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 🔹 무한 스크롤 로직: IntersectionObserver 사용
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && !isLoading) {
        setVisibleCount((prev) =>
          Math.min(prev + LOAD_MORE_COUNT, list.length)
        );
      }
    },
    [list.length, isLoading]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "20px",
      threshold: 0,
    });

    const currentTarget = loadMoreRef.current;
    if (currentTarget) observer.observe(currentTarget);

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [handleObserver]);

  // 현재 보여줄 아이템 계산
  const visibleItems = list.slice(0, visibleCount);

  if (isLoading) return <div className="p-10 text-center">로딩 중...</div>;

  return (
    <div className="flex flex-col w-full p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="px-3 py-1.5 border rounded-lg hover:bg-gray-100 text-sm font-medium text-gray-600 cursor-pointer"
        >
          ◀ 뒤로가기
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          📋 나의 휴가 사용 내역 (전체)
        </h2>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {list.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            신청한 휴가 내역이 없습니다.
          </div>
        ) : (
          <div className="divide-y">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                className="p-3 hover:bg-gray-50 transition-colors"
              >
                {/* 상단 요약 정보 */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-bold ${
                        item.status === "최종 승인 완료"
                          ? "bg-green-100 text-green-700"
                          : item.status.includes("반려")
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {item.status}
                    </span>
                    <h3 className="text-lg font-bold text-gray-800">
                      {item.types}{" "}
                      <span className="text-gray-500 font-normal text-sm">
                        ({item.daysUsed}일)
                      </span>
                    </h3>
                  </div>

                  {/* 대기 상태일 때 취소 버튼 */}
                  {item.status.includes("대기") && (
                    <button
                      onClick={() => handleCancel(item.id)}
                      className="px-3 py-1 bg-red-50 text-red-600 text-xs font-bold rounded border border-red-100 hover:bg-red-100 cursor-pointer"
                    >
                      신청 취소
                    </button>
                  )}
                </div>

                {/* 상세 내용 (그리드 배치) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                  <div>
                    <span className="block text-xs font-bold text-gray-400 mb-1">
                      기간
                    </span>
                    <p className="font-medium text-gray-800">
                      {item.startDate} ~ {item.endDate}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-gray-400 mb-1">
                      사유
                    </span>
                    <p className="text-gray-700">{item.reason || "-"}</p>
                  </div>
                </div>

                {/* 결재 이력 (있을 경우만) */}
                {item.approvalHistory && item.approvalHistory.length > 0 && (
                  <div className="mt-2 pt-3 border-t border-dashed">
                    <span className="text-xs font-bold text-gray-400 block mb-2">
                      결재 진행 내역
                    </span>
                    <ul className="space-y-1">
                      {item.approvalHistory.map((history, idx) => (
                        <li
                          key={idx}
                          className="flex items-center text-xs text-gray-500"
                        >
                          <span className="w-25 font-semibold text-gray-700">
                            {history.approver}
                          </span>
                          <span className="w-38 text-gray-600">
                            [{history.status}]
                          </span>
                          <span className="text-gray-400">
                            {formatDate(history.approvedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {/* 🔹 무한 스크롤 트리거 요소 */}
            {visibleCount < list.length && (
              <div
                ref={loadMoreRef}
                className="p-4 text-center text-gray-400 text-sm"
              >
                불러오는 중...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
