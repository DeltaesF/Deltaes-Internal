"use client";

import VacationModal from "@/components/vacationModal";
import { RootState } from "@/store";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

type DayType = "연차" | "반차" | "병가" | "공가";

// ✅ 직원 타입 정의
interface Employee {
  id: string;
  userName: string;
}

// ✅ 결재선 정보 타입 정의
interface MyInfo {
  recipients?: {
    vacation?: {
      first?: string[];
      second?: string[];
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
      setTypes(dates.map((_, i) => types[i] || "연차"));
    } else {
      setTypes([]);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    const total = types.reduce(
      (sum, type) => sum + (type === "반차" ? 0.5 : 1),
      0
    );
    setDays(Math.round(total * 2) / 2);
  }, [types]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !startDate || !endDate)
      return alert("모든 필드를 입력해주세요.");

    if (firstApprovers.length === 0 && secondApprovers.length === 0) {
      return alert(
        "관리자에 의해 설정된 결재자가 없습니다. 관리자에게 문의하세요."
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
          types,
          days,
          reason,
          approvers: {
            first: firstApprovers,
            second: secondApprovers,
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

  return (
    <div className="p-6 border rounded-xl bg-white shadow-sm mt-6 max-w-5xl mx-auto">
      <h2 className="text-xl font-bold mb-6">📝 휴가원 작성</h2>

      <div className="flex gap-10">
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
          <div className="flex gap-4">
            <label className="flex-1 cursor-pointer">
              시작일
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                // ✅ 클릭 시 달력 열기 기능 추가
                onClick={(e) => e.currentTarget.showPicker()}
                className="border p-2 w-full rounded cursor-pointer"
              />
            </label>
            <label className="flex-1 cursor-pointer">
              종료일
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                // ✅ 클릭 시 달력 열기 기능 추가
                onClick={(e) => e.currentTarget.showPicker()}
                className="border p-2 w-full rounded cursor-pointer"
              />
            </label>
          </div>
          <textarea
            placeholder="사유 입력"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border p-2 h-32 rounded resize-none"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#519d9e] text-white py-3 rounded hover:bg-[#407f80] font-bold cursor-pointer"
          >
            {isSubmitting ? "처리 중..." : "결재 요청"}
          </button>
        </form>

        <div className="w-[300px] flex flex-col gap-4">
          <div className="border p-4 rounded bg-gray-50">
            <h4 className="font-bold text-sm text-gray-600 mb-2">1차 결재자</h4>
            {firstApprovers.length > 0 ? (
              <ul className="list-disc list-inside text-sm">
                {firstApprovers.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm">지정되지 않음</p>
            )}
          </div>

          <div className="border p-4 rounded bg-gray-50">
            <h4 className="font-bold text-sm text-gray-600 mb-2">2차 결재자</h4>
            {secondApprovers.length > 0 ? (
              <p className="text-sm font-semibold">{secondApprovers[0]}</p>
            ) : (
              <p className="text-gray-400 text-sm">지정되지 않음</p>
            )}
          </div>

          <div
            className="border p-4 rounded bg-white border-dashed border-gray-400 cursor-pointer hover:bg-gray-50"
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
          <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
            {allEmployees
              .filter(
                (e) =>
                  e.userName !== userName &&
                  !firstApprovers.includes(e.userName) &&
                  !secondApprovers.includes(e.userName)
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
            className="mt-4 w-full bg-[#519d9e] text-white py-2 rounded cursor-pointer"
          >
            완료
          </button>
        </VacationModal>
      )}
    </div>
  );
}
