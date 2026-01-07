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
  // ✅ approvers 필드 필수 (결재 라인 표시용)
  approvers: {
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };
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

  // 🔹 무한 스크롤을 위한 상태 (보내주신 설정 유지: 5개씩)
  const [visibleCount, setVisibleCount] = useState(5);
  const LOAD_MORE_COUNT = 5;
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

  const formatDate = (
    dateValue: string | number | Date | FirestoreTimestamp | null | undefined
  ) => {
    if (!dateValue) return "-";
    let date: Date;
    if (typeof dateValue === "object" && "seconds" in dateValue) {
      date = new Date(dateValue.seconds * 1000);
    } else {
      date = new Date(dateValue as string | number | Date);
    }
    return date.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ✅ [추가] 결재 상태 렌더링 헬퍼 함수 (스타일은 보내주신 코드의 간격 p-2, mt-2 적용)
  const renderApprovalLine = (item: VacationResponse) => {
    const history = item.approvalHistory || [];
    const firstApprovers = item.approvers?.first || [];
    const secondApprovers = item.approvers?.second || [];
    const thirdApprovers = item.approvers?.third || [];

    const findHistory = (name: string) =>
      history.find((h) => h.approver === name);

    return (
      <div className="mt-2 pt-3 border-t border-dashed">
        <span className="text-xs font-bold text-gray-400 block mb-2">
          결재 진행 내역
        </span>
        <ul className="space-y-1">
          {/* 1차 결재자 목록 */}
          {firstApprovers.map((name) => {
            const h = findHistory(name);
            return (
              <li
                key={`1st-${name}`}
                className="flex items-center text-xs text-gray-500"
              >
                <span className="w-26  font-semibold text-gray-700">
                  {name}
                </span>
                <span className="w-16 text-gray-600 font-medium">1차 결재</span>
                {h ? (
                  <>
                    <span className="text-green-600 font-bold mr-2">
                      [승인]
                    </span>
                    <span className="text-gray-400">
                      {formatDate(h.approvedAt)}
                    </span>
                  </>
                ) : (
                  <span className="text-orange-500 font-medium">[대기]</span>
                )}
              </li>
            );
          })}

          {/* 2차 결재자 목록 */}
          {secondApprovers.map((name) => {
            const h = findHistory(name);
            return (
              <li
                key={`2nd-${name}`}
                className="flex items-center text-xs text-gray-500"
              >
                <span className="w-26 font-semibold text-gray-700">{name}</span>
                <span className="w-16 text-gray-600 font-medium">2차 결재</span>
                {h ? (
                  <>
                    <span className="text-green-600 font-bold mr-2">
                      [승인]
                    </span>
                    <span className="text-gray-400">
                      {formatDate(h.approvedAt)}
                    </span>
                  </>
                ) : (
                  <span className="text-orange-500 font-medium">[대기]</span>
                )}
              </li>
            );
          })}

          {/* 3차 결재자 목록 */}
          {thirdApprovers.map((name) => {
            const h = findHistory(name);
            return (
              <li
                key={`2nd-${name}`}
                className="flex items-center text-xs text-gray-500"
              >
                <span className="w-26 font-semibold text-gray-700">{name}</span>
                <span className="w-16 text-gray-600 font-medium">3차 결재</span>
                {h ? (
                  <>
                    <span className="text-green-600 font-bold mr-2">
                      [승인]
                    </span>
                    <span className="text-gray-400">
                      {formatDate(h.approvedAt)}
                    </span>
                  </>
                ) : (
                  <span className="text-orange-500 font-medium">[대기]</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  // 🔹 무한 스크롤 로직
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
              // ✅ 보내주신 디자인 (p-3) 유지
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

                {/* 상세 내용 (그리드 배치) - 보내주신 디자인 (p-2) 유지 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg mt-2">
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

                {/* ✅ [기능 교체] 결재 진행 내역 표시 (대기/승인 모두 표시) */}
                {renderApprovalLine(item)}
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
