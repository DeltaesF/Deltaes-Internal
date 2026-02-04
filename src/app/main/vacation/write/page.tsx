"use client";

import VacationModal from "@/components/vacationModal";
import { RootState } from "@/store";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

// ✅ [수정] 반차를 오전/오후로 세분
type DayType = "연차" | "오전반차" | "오후반차" | "공가";

interface Employee {
  id: string;
  userName: string;
}

interface MyInfo {
  recipients?: {
    vacation?: {
      first?: string[];
      second?: string[];
      third?: string[];
      shared?: string[];
    };
  };
}

const fetchMyInfo = async (userDocId: string): Promise<MyInfo> => {
  const res = await fetch(`/api/vacation/user?userDocId=${userDocId}`);
  return res.json();
};

const fetchEmployees = async (): Promise<Employee[]> => {
  const res = await fetch("/api/supervisor/employees");
  return res.json();
};

export default function VacationWritePage() {
  const router = useRouter();
  const { userDocId, userName } = useSelector((state: RootState) => state.auth);

  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [types, setTypes] = useState<DayType[]>([]);
  const [days, setDays] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showSharedModal, setShowSharedModal] = useState(false);
  const [sharedList, setSharedList] = useState<string[]>([]);

  const { data: myInfo } = useQuery<MyInfo>({
    queryKey: ["myInfo", userDocId],
    queryFn: () => fetchMyInfo(userDocId!),
    enabled: !!userDocId,
  });

  const { data: allEmployees = [] } = useQuery<Employee[]>({
    queryKey: ["allEmployees"],
    queryFn: fetchEmployees,
  });

  const firstApprovers = myInfo?.recipients?.vacation?.first || [];
  const secondApprovers = myInfo?.recipients?.vacation?.second || [];
  const thirdApprovers = myInfo?.recipients?.vacation?.third || [];

  useEffect(() => {
    if (myInfo?.recipients?.vacation?.shared) {
      setSharedList(myInfo.recipients.vacation.shared);
    }
  }, [myInfo]);

  const getDatesArray = (start: string, end: string) => {
    const arr: string[] = [];
    if (!start || !end) return arr;
    const current = new Date(start);
    const last = new Date(end);
    while (current <= last) {
      arr.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }
    return arr;
  };

  useEffect(() => {
    const dates = getDatesArray(startDate, endDate);
    if (dates.length > 0) {
      setTypes((prev) => {
        // 기존 선택값 유지하되, 없으면 '연차' 기본값
        const newTypes = dates.map((_, i) => (prev[i] as DayType) || "연차");
        return newTypes;
      });
    } else {
      setTypes([]);
    }
  }, [startDate, endDate]);

  // ✅ [수정] 오전/오후 반차는 0.5일로 계산
  useEffect(() => {
    const total = types.reduce((sum, type) => {
      if (type === "오전반차" || type === "오후반차") return sum + 0.5;
      if (type === "공가") return sum + 0; // 공가는 기간엔 포함되지만 차감은 0
      return sum + 1;
    }, 0);
    setDays(Math.round(total * 2) / 2);
  }, [types]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !startDate || !endDate)
      return alert("모든 필드를 입력해주세요.");

    // ✅ [수정된 로직] 1차 결재자만 필수 조건으로 변경
    // 2차, 3차는 없어도(length === 0) 통과됩니다.
    if (firstApprovers.length === 0) {
      return alert(
        "1차 결재자가 설정되지 않았습니다. 관리자에게 문의하여 결재선을 설정해주세요."
      );
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/vacation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userDocId,
          userName,
          startDate,
          endDate,
          types, // ["연차", "오전반차", ...] 형태로 전송됨
          days,
          reason,
          approvers: {
            first: firstApprovers,
            second: secondApprovers, // 없으면 빈 배열로 전송됨 (OK)
            third: thirdApprovers, // 없으면 빈 배열로 전송됨 (OK)
            shared: sharedList,
          },
        }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        alert("휴가 신청이 완료되었습니다.");
        router.push("/main/vacation/user");
      } else {
        alert(result.error || "오류 발생");
      }
    } catch (err) {
      console.error(err);
      alert("서버 오류");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleShared = (name: string) => {
    setSharedList((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const datesList = getDatesArray(startDate, endDate);

  return (
    <div className="p-6 border rounded-xl bg-white shadow-sm mt-6 max-w-5xl mx-auto h-full">
      <h2 className="text-xl font-bold mb-6">📝 휴가원 작성</h2>

      <div className="flex gap-10">
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
          <div className="flex gap-4">
            <label className="flex-1 cursor-pointer font-medium text-gray-700">
              시작일
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker()}
                className="border p-2 w-full rounded cursor-pointer mt-1"
              />
            </label>
            <label className="flex-1 cursor-pointer font-medium text-gray-700">
              종료일
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker()}
                className="border p-2 w-full rounded cursor-pointer mt-1"
              />
            </label>
          </div>

          {datesList.length > 0 && (
            <div className="bg-gray-50 p-4 rounded border">
              <div className="flex justify-between items-center mb-2 border-b pb-2 border-gray-200">
                <span className="font-bold text-gray-700 text-sm">
                  📅 상세 일정 및 종류
                </span>
                <span className="font-bold text-[#519d9e] text-sm">
                  총 {days}일
                </span>
              </div>
              <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                {datesList.map((date, idx) => (
                  <div
                    key={date}
                    className="flex justify-between items-center bg-white px-3 py-2 rounded border shadow-sm"
                  >
                    <span className="text-sm font-medium text-gray-600">
                      {date}
                    </span>
                    {/* ✅ [수정] 드롭다운 옵션 변경 */}
                    <select
                      value={types[idx] || "연차"}
                      onChange={(e) => {
                        const newTypes = [...types];
                        newTypes[idx] = e.target.value as DayType;
                        setTypes(newTypes);
                      }}
                      className="border p-1 rounded text-sm outline-none bg-gray-50 focus:bg-white focus:ring-1 focus:ring-[#519d9e] cursor-pointer"
                    >
                      <option value="연차">연차</option>
                      <option value="오전반차">오전 반차</option>
                      <option value="오후반차">오후 반차</option>
                      <option value="공가">공가</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <textarea
            placeholder="사유 입력"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border p-3 h-32 rounded resize-none focus:ring-1 focus:ring-[#519d9e] outline-none"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#519d9e] text-white py-3 rounded hover:bg-[#407f80] font-bold cursor-pointer transition-colors"
          >
            {isSubmitting ? "처리 중..." : "결재 요청"}
          </button>
        </form>

        <div className="w-[300px] flex flex-col gap-4">
          <div className="border p-4 rounded bg-gray-50">
            <h4 className="font-bold text-sm text-gray-600 mb-2">1차 결재자</h4>
            <p className="text-sm font-semibold text-gray-800">
              {firstApprovers[0] || (
                <span className="text-gray-400">지정되지 않음</span>
              )}
            </p>
          </div>
          <div className="border p-4 rounded bg-gray-50">
            <h4 className="font-bold text-sm text-gray-600 mb-2">2차 결재자</h4>
            <p className="text-sm font-semibold text-gray-800">
              {secondApprovers[0] || (
                <span className="text-gray-400">지정되지 않음</span>
              )}
            </p>
          </div>
          <div className="border p-4 rounded bg-gray-50">
            <h4 className="font-bold text-sm text-gray-600 mb-2">3차 결재자</h4>
            <p className="text-sm font-semibold text-gray-800">
              {thirdApprovers[0] || (
                <span className="text-gray-400">지정되지 않음</span>
              )}
            </p>
          </div>

          <div
            className="border p-4 rounded bg-white border-dashed border-gray-400 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setShowSharedModal(true)}
          >
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-sm text-gray-600">참조/공유자</h4>
              <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                편집
              </span>
            </div>
            {sharedList.length > 0 ? (
              <ul className="list-disc list-inside text-sm text-gray-700">
                {sharedList.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-xs">클릭하여 추가</p>
            )}
          </div>
        </div>
      </div>

      {showSharedModal && (
        <VacationModal onClose={() => setShowSharedModal(false)}>
          <h3 className="text-lg font-bold mb-4">공유자 선택</h3>
          <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {allEmployees
              .filter(
                (e) =>
                  e.userName !== userName &&
                  !firstApprovers.includes(e.userName) &&
                  !secondApprovers.includes(e.userName) &&
                  !thirdApprovers.includes(e.userName)
              )
              .map((emp) => (
                <label
                  key={emp.id}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={sharedList.includes(emp.userName)}
                    onChange={() => handleToggleShared(emp.userName)}
                    className="accent-[#519d9e]"
                  />
                  {emp.userName}
                </label>
              ))}
          </div>
          <button
            onClick={() => setShowSharedModal(false)}
            className="mt-4 w-full bg-[#519d9e] text-white py-2 rounded cursor-pointer hover:bg-[#407f80]"
          >
            완료
          </button>
        </VacationModal>
      )}
    </div>
  );
}
