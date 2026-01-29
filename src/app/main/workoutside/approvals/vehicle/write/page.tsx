"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Editor from "@/components/editor";

// 현재 날짜와 시간 구하기 (YYYY-MM-DD HH:mm)
const getTodayWithTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// ----------------------------------------------------------------
// [Type Definitions]
// ----------------------------------------------------------------
type WorkType = "outside" | "trip";
type TransportType = "company_car" | "personal_car" | "public" | "other";

interface ExpenseItem {
  date: string;
  detail: string;
}

interface FormState {
  implementDate: string; // 시행일자

  // 방문고객 상세정보
  customerName: string; // 고객사
  customerDept: string; // 부서명 (New)
  customerEmail: string; // 이메일 (New)
  customerContact: string; // 이름 (담당자)

  title: string; // 제목 (외근 내용)

  // 기간 정보
  usageDate: string; // 외근 일시 (단일) (New)

  periodStart: string; // 출장 시작
  periodEnd: string; // 출장 종료

  // 법인차량용
  vehicleModel: string;

  // 대중교통 비용
  costBus: number;
  costSubway: number;
  costTaxi: number;
  costOther: number;

  // 출장용 추가 정보
  tripDestination: string;
  tripCompanions: string;
  tripExpenses: ExpenseItem[];
}

const TRANSPORT_OPTIONS = [
  { val: "company_car", label: "법인차량" },
  { val: "personal_car", label: "자차" },
  { val: "public", label: "대중교통" },
  { val: "other", label: "기타" },
] as const;

export default function IntegratedWritePage() {
  const router = useRouter();
  const { userName } = useSelector((state: RootState) => state.auth);

  const [workType, setWorkType] = useState<WorkType>("outside");
  const [transportType, setTransportType] =
    useState<TransportType>("company_car");

  const [form, setForm] = useState<FormState>({
    implementDate: getTodayWithTime().split(" ")[0], // YYYY-MM-DD

    customerName: "",
    customerDept: "",
    customerEmail: "",
    customerContact: "",

    title: "",

    usageDate: "", // 외근용 단일 일시
    periodStart: "",
    periodEnd: "",

    vehicleModel: "",

    costBus: 0,
    costSubway: 0,
    costTaxi: 0,
    costOther: 0,

    tripDestination: "",
    tripCompanions: "",
    tripExpenses: [{ date: "", detail: "" }],
  });

  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ✅ [수정] 이동수단에 따라 텍스트 자동 입력
  useEffect(() => {
    if (transportType === "company_car") {
      setForm((prev) => ({ ...prev, vehicleModel: "스타리아 377주 7412" }));
    } else if (transportType === "personal_car") {
      setForm((prev) => ({ ...prev, vehicleModel: "자차이용" })); // 자차 선택 시
    } else if (transportType === "other") {
      setForm((prev) => ({ ...prev, vehicleModel: "도보" })); // 기타 선택 시
    } else {
      setForm((prev) => ({ ...prev, vehicleModel: "" }));
    }
  }, [transportType]);

  const handleCancel = () => {
    if (
      confirm(
        "작성 중인 내용이 저장되지 않을 수 있습니다. 정말 나가시겠습니까?"
      )
    ) {
      router.back();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const addExpense = () => {
    setForm((prev) => ({
      ...prev,
      tripExpenses: [...prev.tripExpenses, { date: "", detail: "" }],
    }));
  };

  const removeExpense = (index: number) => {
    setForm((prev) => ({
      ...prev,
      tripExpenses: prev.tripExpenses.filter((_, i) => i !== index),
    }));
  };

  const handleExpenseChange = (
    index: number,
    field: keyof ExpenseItem,
    value: string
  ) => {
    const newExpenses = [...form.tripExpenses];
    newExpenses[index][field] = value;
    setForm((prev) => ({ ...prev, tripExpenses: newExpenses }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // 필수값 검증
    if (!form.title || !form.customerName || !form.customerContact) {
      return alert("필수 항목(제목, 고객사, 담당자 이름)을 입력해주세요.");
    }

    if (workType === "outside" && !form.usageDate) {
      return alert("외근 일시를 입력해주세요.");
    }

    if (workType === "trip") {
      if (!form.periodStart || !form.periodEnd)
        return alert("출장 기간을 입력해주세요.");
      if (!form.tripDestination) return alert("출장지를 입력해주세요.");
    }

    setIsLoading(true);

    // 출장 기간 문자열 조합
    const tripPeriodString = `${form.periodStart.replace(
      "T",
      " "
    )} ~ ${form.periodEnd.replace("T", " ")}`;

    const payload = {
      userName,
      approvalType: "integrated_outside",
      title: `${form.title}`,
      content,
      createdAt: Date.now(),

      workType,
      transportType,
      implementDate: form.implementDate,

      // 방문고객 상세정보
      customerName: form.customerName,
      customerDept: form.customerDept,
      customerEmail: form.customerEmail,
      customerContact: form.customerContact, // 이름

      // 기간 정보 (외근은 usageDate, 출장은 tripPeriod 사용)
      usageDate:
        workType === "outside" ? form.usageDate.replace("T", " ") : null,
      tripPeriod: workType === "trip" ? tripPeriodString : null,

      // 출장 전용
      tripDestination: workType === "trip" ? form.tripDestination : null,
      tripCompanions: workType === "trip" ? form.tripCompanions : null,
      tripExpenses: workType === "trip" ? form.tripExpenses : [],

      // 이동 수단별
      vehicleModel:
        transportType === "company_car" || transportType === "personal_car"
          ? form.vehicleModel
          : null,
      transportCosts:
        transportType === "public"
          ? {
              bus: form.costBus,
              subway: form.costSubway,
              taxi: form.costTaxi,
              other: form.costOther,
            }
          : null,
    };

    try {
      const res = await fetch("/api/approvals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("저장 실패");
      alert("상신되었습니다.");
      router.push("/main/workoutside/approvals/vehicle");
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-6">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">
          📝 외근 / 출장 신청서
        </h2>
        <button
          onClick={handleCancel}
          className="px-4 py-2 border rounded hover:bg-gray-100 text-sm cursor-pointer"
        >
          ◀ 취소
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 text-sm">
        {/* 1. 기본 정보 (작성자, 기안일, 기간) */}
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <label className="block font-bold mb-1 text-gray-700">
                작성자
              </label>
              <input
                type="text"
                value={userName || ""}
                readOnly
                className="w-full border p-2 rounded bg-white text-gray-600"
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-gray-700">
                기안 일시
              </label>
              <input
                type="text"
                value={getTodayWithTime()} // 날짜+시간 표시
                readOnly
                className="w-full border p-2 rounded bg-white text-gray-600 font-mono"
              />
            </div>
          </div>

          {/* 기간 입력 (외근: 단일, 출장: 범위) */}
          <div>
            <label className="block font-bold mb-1 text-gray-700">
              {workType === "outside" ? "외근 일시" : "출장 기간"}{" "}
              <span className="text-red-500">*</span>
            </label>

            {workType === "outside" ? (
              // 외근: 1개로 통합
              <input
                type="date"
                name="usageDate"
                value={form.usageDate}
                onChange={handleChange}
                className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e] bg-white"
              />
            ) : (
              // 출장: 시작 ~ 종료
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  name="periodStart"
                  value={form.periodStart}
                  onChange={handleChange}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e] bg-white"
                />
                <span className="text-gray-500 font-bold">~</span>
                <input
                  type="date"
                  name="periodEnd"
                  value={form.periodEnd}
                  onChange={handleChange}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e] bg-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* 2. 구분 및 이동방법 */}
        <div className="bg-white p-5 rounded-lg border border-gray-300 space-y-4">
          {/* 구분 */}
          <div className="flex items-center gap-6">
            <span className="font-bold w-20 text-gray-800">구분</span>
            <label className="flex items-center gap-2 cursor-pointer hover:text-[#519d9e]">
              <input
                type="radio"
                checked={workType === "outside"}
                onChange={() => setWorkType("outside")}
                className="w-4 h-4 accent-[#519d9e]"
              />
              외근
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-[#519d9e]">
              <input
                type="radio"
                checked={workType === "trip"}
                onChange={() => setWorkType("trip")}
                className="w-4 h-4 accent-[#519d9e]"
              />
              출장
            </label>
          </div>

          <div className="h-px bg-gray-300"></div>

          {/* 이동방법 */}
          <div className="flex items-center gap-6">
            <span className="font-bold w-20 text-gray-800">이동방법</span>
            {TRANSPORT_OPTIONS.map((opt) => (
              <label
                key={opt.val}
                className="flex items-center gap-2 cursor-pointer hover:text-[#519d9e]"
              >
                <input
                  type="radio"
                  checked={transportType === opt.val}
                  onChange={() => setTransportType(opt.val)}
                  className="w-4 h-4 accent-[#519d9e]"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* 3. [수정됨] 방문고객 상세정보 */}
        <div className="border-t pt-4">
          <h3 className="font-bold text-lg mb-4 text-[#519d9e] border-l-4 border-[#519d9e] pl-2">
            방문고객 상세정보
          </h3>

          {/* 출장지/동행자 (출장일 때만) */}
          {workType === "trip" && (
            <div className="grid grid-cols-2 gap-4 mb-4 bg-gray-50 p-3 rounded border">
              <div>
                <label className="block font-bold mb-1 text-gray-700">
                  출장지 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="tripDestination"
                  value={form.tripDestination}
                  onChange={handleChange}
                  placeholder="예: 부산 지사"
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block font-bold mb-1 text-gray-700">
                  동행자
                </label>
                <input
                  type="text"
                  name="tripCompanions"
                  value={form.tripCompanions}
                  onChange={handleChange}
                  placeholder="예: 김철수 대리"
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>
          )}

          {/* 고객 정보 4개 필드 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block font-bold mb-1 text-gray-700">
                고객사 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="customerName"
                value={form.customerName}
                onChange={handleChange}
                placeholder="예: 삼성전자"
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-gray-700">
                부서명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="customerDept"
                value={form.customerDept}
                onChange={handleChange}
                placeholder="예: 개발 1팀"
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-gray-700">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="customerEmail"
                value={form.customerEmail}
                onChange={handleChange}
                placeholder="email@example.com"
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-gray-700">
                이름 (담당자) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="customerContact"
                value={form.customerContact}
                onChange={handleChange}
                placeholder="예: 홍길동 책임"
                className="w-full border p-2 rounded"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-700">
              외근/출장 내용 (제목) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="방문 목적 및 내용을 입력하세요"
              className="w-full border p-2 rounded focus:ring-1 focus:ring-[#519d9e]"
            />
          </div>
        </div>

        {/* 4. 이동수단별 추가 정보 */}
        {transportType === "company_car" && (
          <div className="bg-blue-50 p-4 rounded border border-blue-200 mt-2">
            <h4 className="font-bold text-blue-800 mb-2">🚙 차량 정보</h4>
            {/* 사용 일시 필드는 상단 공통 필드로 통합되어 제거됨 */}
            <div>
              <label className="block font-bold mb-1 text-xs text-blue-700">
                차량 모델
              </label>
              <input
                type="text"
                name="vehicleModel"
                value={form.vehicleModel}
                onChange={handleChange}
                className="w-full border p-2 rounded bg-white"
              />
            </div>
            {/* 7. 이용수칙 */}
            {transportType === "company_car" && (
              <div className="border rounded bg-gray-50 p-4 text-xs text-gray-600 mt-2">
                <h4 className="font-bold mb-2 text-sm text-gray-800 text-[16px]">
                  📌 법인차량 이용수칙
                </h4>
                <ul className="list-decimal list-inside space-y-1 text-[14px]">
                  <li>개인적인 목적으로 이용 신청 불가 (*행사계획서 별첨)</li>

                  <li>
                    이용에 따른 유류비는 법인카드 사용 (주유한 영수증 보관
                    필수/주유량과 단가 확인)
                  </li>

                  <li>
                    운전자는 만 26세 이상 운전면허 소지자여야 함 (자동차보험
                    연령한정특약 조건)
                  </li>
                  <li>운전자 면허증 사본 제출</li>
                  <li>차량운행일지 반드시 작성 (차량에 비치되어 있음)</li>
                  <li>차량은 이용자가 직접 수령, 청소 완료 후 직접 반납</li>

                  <li>
                    사고 발생 시 법인(070-8255-6004)에 보고 후 이용자가 처리비용
                    부담
                  </li>
                  <li>
                    도로교통법 등의 위반으로 인한 과태료 및 기타 법적인 책임은
                    이용자 임을 유의
                  </li>
                  <li>
                    기타 사고 및 고장 발생 시 이용자가 수리비용과 기타정비에
                    대한 책임을 짐
                  </li>
                  <li>위의 사항은 결재 후 임의로 변경할 수 없음</li>
                </ul>
                <div className="mt-3 pt-3 border-t font-bold text-gray-800 flex items-center gap-2">
                  <input
                    type="checkbox"
                    required
                    className="accent-[#519d9e] w-4 h-4 cursor-pointer"
                  />
                  위 내용을 확인하였으며 신청합니다.
                </div>
                <p className="text-right mt-2 text-[14px] text-gray-700">
                  신청인: {userName}
                </p>
              </div>
            )}
          </div>
        )}

        {transportType === "public" && (
          <div className="bg-green-50 p-4 rounded border border-green-200">
            <h4 className="font-bold text-green-800 mb-2">
              🚌 대중교통 비용 (예상)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 비용 입력 필드들 생략 없이 그대로 유지 */}
              <div>
                <span className="block mb-1 text-xs font-bold text-green-700">
                  버스
                </span>
                <input
                  type="number"
                  name="costBus"
                  value={form.costBus}
                  onChange={handleChange}
                  className="w-full border p-2 rounded bg-white"
                  placeholder="0"
                />
              </div>
              <div>
                <span className="block mb-1 text-xs font-bold text-green-700">
                  지하철
                </span>
                <input
                  type="number"
                  name="costSubway"
                  value={form.costSubway}
                  onChange={handleChange}
                  className="w-full border p-2 rounded bg-white"
                  placeholder="0"
                />
              </div>
              <div>
                <span className="block mb-1 text-xs font-bold text-green-700">
                  택시
                </span>
                <input
                  type="number"
                  name="costTaxi"
                  value={form.costTaxi}
                  onChange={handleChange}
                  className="w-full border p-2 rounded bg-white"
                  placeholder="0"
                />
              </div>
              <div>
                <span className="block mb-1 text-xs font-bold text-green-700">
                  기타
                </span>
                <input
                  type="number"
                  name="costOther"
                  value={form.costOther}
                  onChange={handleChange}
                  className="w-full border p-2 rounded bg-white"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. 출장 경비 (출장일 경우) */}
        {workType === "trip" && (
          <div className="border rounded-lg p-4 bg-white mt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-sm text-gray-700">
                💰 출장 경비 (추가 발생 비용)
              </h4>
              <button
                type="button"
                onClick={addExpense}
                className="text-xs bg-gray-100 border px-2 py-1 rounded hover:bg-gray-200"
              >
                + 행 추가
              </button>
            </div>
            {form.tripExpenses.map((exp, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  type="date"
                  value={exp.date}
                  onChange={(e) =>
                    handleExpenseChange(idx, "date", e.target.value)
                  }
                  className="border p-1 rounded text-sm"
                />
                <input
                  type="text"
                  value={exp.detail}
                  onChange={(e) =>
                    handleExpenseChange(idx, "detail", e.target.value)
                  }
                  placeholder="내역 및 금액"
                  className="border p-1 rounded text-sm flex-1"
                />
                {form.tripExpenses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExpense(idx)}
                    className="text-red-500 px-2 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 6. 상세 에디터 */}
        <div className="mt-4">
          <label className="block font-bold mb-2 text-gray-700">
            외근/출장 사유 (계획 등)
          </label>
          <Editor content={content} onChange={setContent} />
        </div>

        <div className="flex justify-end gap-3 border-t pt-4 mt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 font-bold text-gray-700 cursor-pointer"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-[#519d9e] text-white rounded font-bold hover:bg-[#407f80] shadow-md cursor-pointer"
          >
            {isLoading ? "제출 중..." : "상신 요청"}
          </button>
        </div>

        {/* ✅ 결과 보고서 섹션 (비활성화 + 안내 문구) */}
        <div className="mt-8 relative border-t-4 border-gray-300 pt-6">
          <h3 className="text-lg font-bold mb-2 text-gray-400">
            🚩 외근/출장 결과 보고서
          </h3>
          <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 h-[150px]">
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/60 backdrop-blur-[1px] z-10">
              <div className="bg-white px-5 py-2 rounded-full shadow border border-gray-300 flex items-center gap-2">
                <span className="text-lg">🔒</span>
                <span className="font-bold text-gray-600 text-sm">
                  외근/출장 다녀오시면 꼭 작성해주세요.
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
