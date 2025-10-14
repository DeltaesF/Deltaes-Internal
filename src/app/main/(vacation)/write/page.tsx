"use client";

import { RootState } from "@/store";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";

type Props = { onCancel: () => void };
type DayType = "연차" | "반차" | "병가" | "공가";

export default function VacationWrite({ onCancel }: Props) {
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [types, setTypes] = useState<DayType[]>([]);
  const [days, setDays] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redux에서 로그인된 사용자 정보
  const { userDocId, userName } = useSelector((state: RootState) => state.auth);

  const getDayUnit = (type: DayType) => (type === "반차" ? 0.5 : 1);

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
      const newDayTypes = dates.map((_, i) => types[i] || "연차");
      setTypes(newDayTypes);
    } else {
      setTypes([]);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    const total = types.reduce((sum, type) => sum + getDayUnit(type), 0);
    setDays(Math.round(total * 2) / 2); // 0.5 단위 반올림
  }, [types]);

  const handleDayTypeChange = (index: number, value: DayType) => {
    const updated = [...types];
    updated[index] = value;
    setTypes(updated);
  };

  const handleCancel = () => {
    if (
      window.confirm(
        "작성 중인 내용이 저장되지 않을 수 있습니다. 정말 나가시겠습니까?"
      )
    ) {
      onCancel();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !startDate || !endDate) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    if (!userDocId) {
      alert("로그인 정보가 없습니다.");
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await fetch("/api/vacation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userDocId,
          startDate,
          endDate,
          types,
          days,
          reason,
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        alert(`${userName}님의 휴가 신청이 완료되었습니다.\n총 ${days}일 사용`);
        onCancel();
      } else {
        alert(result.error || "휴가 신청 중 오류가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("서버 통신 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <button onClick={handleCancel} className="mb-4 px-4 py-2 border rounded">
        ◀ 나가기
      </button>

      <h2 className="text-lg font-bold mb-4">📊 휴가원 작성</h2>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 mt-4 w-[600px]"
      >
        <textarea
          placeholder="휴가 사유를 입력하세요"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="border p-2 rounded h-32 resize-none"
        />

        <div className="flex gap-4">
          <label className="flex flex-col flex-1">
            시작일
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border p-2 rounded"
            />
          </label>

          <label className="flex flex-col flex-1">
            종료일
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border p-2 rounded"
            />
          </label>
        </div>

        {types.length > 0 && (
          <div className="flex flex-col gap-2">
            {getDatesArray(startDate, endDate).map((date, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-24">{date}</span>
                <select
                  value={types[i]}
                  onChange={(e) =>
                    handleDayTypeChange(i, e.target.value as DayType)
                  }
                  className="border p-1 rounded"
                >
                  <option value="연차">연차</option>
                  <option value="반차">반차</option>
                  <option value="병가">병가</option>
                  <option value="공가">공가</option>
                </select>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-4 mt-2">
          <label className="flex flex-col flex-1">
            총 사용 일수
            <input
              type="number"
              value={days}
              readOnly
              className="border p-2 rounded bg-gray-100 cursor-not-allowed"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`px-4 py-2 rounded text-white ${
            isSubmitting ? "bg-gray-400" : "bg-[#519d9e] hover:bg-[#3f8b8c]"
          }`}
        >
          {isSubmitting ? "처리 중..." : "작성 완료"}
        </button>
      </form>
    </div>
  );
}
