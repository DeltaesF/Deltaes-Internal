"use client";

import VacationModal from "@/components/vacationModal";
import { RootState } from "@/store";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";

type Props = { onCancel: () => void };
type DayType = "연차" | "반차" | "병가" | "공가";

type ApproverType = "first" | "second" | "shared";

export default function VacationWrite({ onCancel }: Props) {
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [types, setTypes] = useState<DayType[]>([]);
  const [days, setDays] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // 🔹 선택된 결재자
  const [approvers, setApprovers] = useState({
    first: [] as string[],
    second: [] as string[],
    shared: [] as string[],
  });

  // 🔹 현재 빨간 테두리로 선택된 대상
  const [selectedBox, setSelectedBox] = useState<ApproverType | null>(null);

  // 🔹 전체 임직원 목록 (예시, Firestore에서 불러올 수도 있음)
  const employees = [
    "원영수 대표이사",
    "민동호 연구소장",
    "박병우 영업본부장",
    "원인영 경영부장",
    "정두원 프로",
  ];

  // ✅ 넣기 버튼
  const handleAdd = (name: string) => {
    if (!selectedBox) return alert("결재 위치(1차/2차/공유자)를 선택하세요.");

    setApprovers((prev) => {
      const list = prev[selectedBox];
      if (list.includes(name)) {
        alert("이미 추가된 결재자입니다.");
        return prev;
      }
      return { ...prev, [selectedBox]: [...list, name] };
    });
  };

  // ✅ 빼기 버튼
  const handleRemove = () => {
    if (!selectedBox) return alert("결재 위치를 선택하세요.");
    setApprovers((prev) => ({ ...prev, [selectedBox]: [] })); // 전체 제거
  };

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

    if (
      approvers.first.length === 0 &&
      approvers.second.length === 0 &&
      approvers.shared.length === 0
    ) {
      alert("최소 1명의 결재자를 선택해야 합니다.");
      return;
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
          approvers,
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
    <div className="p-6">
      <button
        onClick={handleCancel}
        className="mb-4 px-4 py-2 border rounded cursor-pointer"
      >
        ◀ 나가기
      </button>

      <div className="p-6">
        <h2 className="text-lg font-bold">📊 휴가원 작성</h2>

        {/* ✅ 휴가원 작성 | 결재 | 결재내역 한 줄 배치 */}
        <div className="flex items-start gap-12">
          {/* 1️⃣ 휴가원 작성 폼 */}
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
              className={`cursor-pointer px-4 py-2 rounded text-white ${
                isSubmitting ? "bg-gray-400" : "bg-[#519d9e] hover:bg-[#3f8b8c]"
              }`}
            >
              {isSubmitting ? "처리 중..." : "작성 완료"}
            </button>
          </form>

          {/* 2️⃣ 결재 버튼 */}
          <div className="flex flex-col items-center justify-start mt-4 ">
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-[#519d9e] text-white rounded hover:bg-[#3f8b8c] shadow cursor-pointer"
            >
              결재
            </button>
          </div>

          {/* 3️⃣ 결재 내역 박스 */}
          <div className="flex flex-col gap-4 mt-4">
            <div className="w-[300px] min-h-[140px] border rounded p-3 shadow bg-gray-50 text-sm">
              <div className="font-semibold mb-1">1차 결재</div>
              {approvers.first.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {approvers.first.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400">선택된 결재자가 없습니다</p>
              )}
            </div>

            <div className="w-[300px] min-h-[140px] border rounded p-3 shadow bg-gray-50 text-sm">
              <div className="font-semibold mb-1">2차 결재</div>
              {approvers.second.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {approvers.second.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400">선택된 결재자가 없습니다</p>
              )}
            </div>

            <div className="w-[300px] min-h-[140px] border rounded p-3 shadow bg-gray-50 text-sm">
              <div className="font-semibold mb-1">공유자</div>
              {approvers.shared.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {approvers.shared.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400">선택된 공유자가 없습니다</p>
              )}
            </div>
          </div>

          {/* 🔹 결재자 선택 모달 */}
          {showModal && (
            <VacationModal onClose={() => setShowModal(false)}>
              <div className="flex gap-6">
                {/* 좌측: 임직원 목록 */}
                <div className="flex-1 border rounded p-4 min-h-[400px] overflow-y-auto">
                  <h3 className="font-semibold mb-2">임직원 목록</h3>
                  {employees.map((name) => (
                    <div
                      key={name}
                      onClick={() => handleAdd(name)}
                      className="p-2 hover:bg-gray-200 cursor-pointer rounded"
                    >
                      {name}
                    </div>
                  ))}
                </div>

                {/* 중앙: 버튼 */}
                <div className="flex flex-col justify-center items-center gap-4">
                  <button
                    onClick={() => handleRemove()}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    빼기
                  </button>
                </div>

                {/* 우측: 선택 결과 */}
                <div className="flex flex-col gap-3 border rounded p-4 w-[250px]">
                  <div
                    onClick={() => setSelectedBox("first")}
                    className={`p-2 rounded cursor-pointer ${
                      selectedBox === "first"
                        ? "border-2 border-red-500"
                        : "border"
                    }`}
                  >
                    <strong>1차결재:</strong>{" "}
                    {approvers.first.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1">
                        {approvers.first.map((name, i) => (
                          <li key={i}>{name}</li>
                        ))}
                      </ul>
                    ) : (
                      "-"
                    )}
                  </div>

                  <div
                    onClick={() => setSelectedBox("second")}
                    className={`p-2 rounded cursor-pointer ${
                      selectedBox === "second"
                        ? "border-2 border-red-500"
                        : "border"
                    }`}
                  >
                    <strong>2차결재:</strong>{" "}
                    {approvers.second.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1">
                        {approvers.second.map((name, i) => (
                          <li key={i}>{name}</li>
                        ))}
                      </ul>
                    ) : (
                      "-"
                    )}
                  </div>

                  <div
                    onClick={() => setSelectedBox("shared")}
                    className={`p-2 rounded cursor-pointer ${
                      selectedBox === "shared"
                        ? "border-2 border-red-500"
                        : "border"
                    }`}
                  >
                    <strong>공유자:</strong>{" "}
                    {approvers.shared.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1">
                        {approvers.shared.map((name, i) => (
                          <li key={i}>{name}</li>
                        ))}
                      </ul>
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
              </div>
            </VacationModal>
          )}
        </div>
      </div>
    </div>
  );
}
