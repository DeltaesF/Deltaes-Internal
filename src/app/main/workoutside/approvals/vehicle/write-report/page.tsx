"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Editor from "@/components/editor";

const getTodayWithTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

type UIWorkType = "outside" | "trip";
type TransportType = "company_car" | "personal_car" | "public" | "other";

interface ExpenseItem {
  date: string;
  detail: string;
}

interface ReportFormState {
  implementDate: string; // 작성일

  customerName: string;
  customerDept: string;
  customerEmail: string;
  customerContact: string;

  title: string;

  // 기간 (실제 수행 기간)
  usageDate: string; // 외근 일시
  periodStart: string; // 출장 시작
  periodEnd: string; // 출장 종료

  // 이동수단 및 비용
  vehicleModel: string;
  costBus: number;
  costSubway: number;
  costTaxi: number;
  costOther: number;

  // 출장 전용
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

export default function ResultReportWritePage() {
  const router = useRouter();
  const { userName } = useSelector((state: RootState) => state.auth);

  const [uiWorkType, setUiWorkType] = useState<UIWorkType>("outside");
  const [transportType, setTransportType] =
    useState<TransportType>("company_car");

  const [form, setForm] = useState<ReportFormState>({
    implementDate: getTodayWithTime().split(" ")[0],
    customerName: "",
    customerDept: "",
    customerEmail: "",
    customerContact: "",
    title: "",

    usageDate: "",
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
    if (confirm("작성 중인 내용이 저장되지 않습니다. 나가시겠습니까?"))
      router.back();
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  // 경비 핸들러
  const addExpense = () =>
    setForm((p) => ({
      ...p,
      tripExpenses: [...p.tripExpenses, { date: "", detail: "" }],
    }));
  const removeExpense = (idx: number) =>
    setForm((p) => ({
      ...p,
      tripExpenses: p.tripExpenses.filter((_, i) => i !== idx),
    }));
  const handleExpenseChange = (
    idx: number,
    field: keyof ExpenseItem,
    val: string
  ) => {
    const newExp = [...form.tripExpenses];
    newExp[idx][field] = val;
    setForm((p) => ({ ...p, tripExpenses: newExp }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.customerName)
      return alert("필수 항목을 입력해주세요.");

    // 외근 보고인데 일시가 없거나, 출장 보고인데 기간이 없으면 경고
    if (uiWorkType === "outside" && !form.usageDate)
      return alert("외근 일시를 입력해주세요.");
    if (uiWorkType === "trip" && (!form.periodStart || !form.periodEnd))
      return alert("출장 기간을 입력해주세요.");

    setIsLoading(true);

    const periodString = `${form.periodStart.replace(
      "T",
      " "
    )} ~ ${form.periodEnd.replace("T", " ")}`;

    // ✅ [핵심 변경] 저장할 uiWorkType 결정 (outside_report / trip_report)
    const finalWorkType =
      uiWorkType === "outside" ? "outside_report" : "trip_report";

    const payload = {
      userName,
      approvalType: "integrated_outside",
      title: `${form.title}`,
      content,
      createdAt: Date.now(),

      workType: finalWorkType, // 전에 uiWorkType으로 되어 있어 인식이 안되는 상황
      transportType,
      implementDate: form.implementDate,

      customerName: form.customerName,
      customerDept: form.customerDept,
      customerEmail: form.customerEmail,
      customerContact: form.customerContact,

      usageDate:
        uiWorkType === "outside" ? form.usageDate.replace("T", " ") : null,
      tripPeriod: uiWorkType === "trip" ? periodString : null,

      tripDestination: uiWorkType === "trip" ? form.tripDestination : null,
      tripCompanions: uiWorkType === "trip" ? form.tripCompanions : null,
      tripExpenses: uiWorkType === "trip" ? form.tripExpenses : [],

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
      alert("결과보고서가 등록되었습니다.");
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
          🚩 외근/출장 결과보고서 작성
        </h2>
        <button
          onClick={handleCancel}
          className="px-4 py-2 border rounded hover:bg-gray-100 text-sm cursor-pointer"
        >
          ◀ 취소
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 text-sm">
        {/* 1. 기본 정보 */}
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
                작성일시
              </label>
              <input
                type="text"
                value={getTodayWithTime()}
                readOnly
                className="w-full border p-2 rounded bg-white text-gray-600 font-mono"
              />
            </div>
          </div>

          {/* 기간 입력 (활동 기간) */}
          <div>
            <label className="block font-bold mb-1 text-gray-700">
              {uiWorkType === "outside" ? "외근 일시" : "출장 기간"}{" "}
              <span className="text-red-500">*</span>
            </label>
            {uiWorkType === "outside" ? (
              <input
                type="date"
                name="usageDate"
                value={form.usageDate}
                onChange={handleChange}
                className="w-full border p-2 rounded focus:ring-2 focus:ring-purple-500 bg-white"
              />
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  name="periodStart"
                  value={form.periodStart}
                  onChange={handleChange}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-purple-500 bg-white"
                />
                <span className="text-gray-500 font-bold">~</span>
                <input
                  type="date"
                  name="periodEnd"
                  value={form.periodEnd}
                  onChange={handleChange}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* 2. 구분 및 이동방법 */}
        <div className="bg-purple-50 p-5 rounded-lg border border-purple-100 space-y-4">
          <div className="flex items-center gap-6">
            <span className="font-bold w-20 text-gray-800">구분</span>
            <label className="flex items-center gap-2 cursor-pointer hover:text-purple-600">
              <input
                type="radio"
                checked={uiWorkType === "outside"}
                onChange={() => setUiWorkType("outside")}
                className="w-4 h-4 accent-purple-600"
              />{" "}
              외근 보고
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-purple-600">
              <input
                type="radio"
                checked={uiWorkType === "trip"}
                onChange={() => setUiWorkType("trip")}
                className="w-4 h-4 accent-purple-600"
              />{" "}
              출장 보고
            </label>
          </div>

          <div className="h-px bg-purple-200"></div>

          <div className="flex items-center gap-6">
            <span className="font-bold w-20 text-gray-800">이동수단</span>
            {TRANSPORT_OPTIONS.map((opt) => (
              <label
                key={opt.val}
                className="flex items-center gap-2 cursor-pointer hover:text-purple-600"
              >
                <input
                  type="radio"
                  checked={transportType === opt.val}
                  onChange={() => setTransportType(opt.val)}
                  className="w-4 h-4 accent-purple-600"
                />{" "}
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* 3. 방문 정보 */}
        <div className="border-t pt-4">
          <h3 className="font-bold text-lg mb-4 text-purple-700 border-l-4 border-purple-700 pl-2">
            방문고객 상세정보
          </h3>

          {/* 출장일 때만 표시 */}
          {uiWorkType === "trip" && (
            <div className="grid grid-cols-2 gap-4 mb-4 bg-gray-50 p-3 rounded border">
              <div>
                <label className="block font-bold mb-1">출장지</label>
                <input
                  type="text"
                  name="tripDestination"
                  value={form.tripDestination}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">동행자</label>
                <input
                  type="text"
                  name="tripCompanions"
                  value={form.tripCompanions}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>
          )}

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
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-gray-700">
                담당자 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="customerContact"
                value={form.customerContact}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-700">
              보고서 제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              className="w-full border p-2 rounded font-bold"
              placeholder="OOO 미팅 결과 보고"
            />
          </div>
        </div>

        {/* 4. 이동수단별 추가 정보 */}
        {transportType === "company_car" && (
          <div className="bg-purple-50 p-4 rounded border border-purple-200 mt-2">
            <h4 className="font-bold text-purple-800 mb-2">🚙 차량 정보</h4>
            <div>
              <label className="block font-bold mb-1 text-xs text-purple-700">
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
          </div>
        )}

        {transportType === "public" && (
          <div className="bg-green-50 p-4 rounded border border-green-200 mt-2">
            <h4 className="font-bold text-green-800 mb-2">
              🚌 대중교통 비용 (실비)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. 출장 경비 (출장 시에만) */}
        {uiWorkType === "trip" && (
          <div className="border rounded-lg p-4 bg-white mt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-gray-700">💰 지출 경비 내역</h4>
              <button
                type="button"
                onClick={addExpense}
                className="text-xs border px-2 py-1 rounded bg-gray-50 hover:bg-gray-100"
              >
                + 추가
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
                  className="border p-1 rounded flex-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeExpense(idx)}
                  className="text-red-500 font-bold px-2"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 6. 결과 내용 에디터 */}
        <div className="mt-4">
          <label className="block font-bold mb-2 text-gray-700">
            업무 협의 내용
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
            className="px-6 py-2 bg-purple-600 text-white rounded font-bold hover:bg-purple-700 shadow-md cursor-pointer"
          >
            {isLoading ? "저장 중..." : "보고서 상신"}
          </button>
        </div>
      </form>
    </div>
  );
}
