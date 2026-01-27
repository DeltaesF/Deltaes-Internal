"use client";

import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Editor from "@/components/editor";

// ----------------------------------------------------------------
// [Type Definitions]
// ----------------------------------------------------------------
type WorkType = "outside" | "trip";
type TransportType = "company_car" | "personal_car" | "public" | "other";

interface ExpenseItem {
  date: string;
  detail: string;
}

interface TransportCosts {
  bus: number;
  subway: number;
  taxi: number;
  other: number;
}

interface FormState {
  implementDate: string;
  customerName: string;
  customerDept: string;
  customerEmail: string;
  customerContact: string;
  title: string;

  workType: WorkType;
  transportType: TransportType;

  // 기간 (외근: 단일 일시, 출장: 기간)
  usageDate: string;
  periodStart: string;
  periodEnd: string;

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

interface ApprovalDetailResponse {
  id: string;
  userName: string;
  approvalType: string;
  title: string;
  content: string;

  // 통합 필드
  workType?: WorkType;
  transportType?: TransportType;
  implementDate?: string;

  customerName?: string;
  customerDept?: string;
  customerEmail?: string;
  customerContact?: string;

  usageDate?: string;
  tripPeriod?: string;

  vehicleModel?: string;
  transportCosts?: TransportCosts;

  tripDestination?: string;
  tripCompanions?: string;
  tripExpenses?: ExpenseItem[];
}

const TRANSPORT_OPTIONS = [
  { val: "company_car", label: "법인차량" },
  { val: "personal_car", label: "자차" },
  { val: "public", label: "대중교통" },
  { val: "other", label: "기타" },
] as const;

const fetchReportDetail = async (
  id: string
): Promise<ApprovalDetailResponse> => {
  const res = await fetch("/api/approvals/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export default function IntegratedEditPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { userName } = useSelector((state: RootState) => state.auth);

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [content, setContent] = useState("");

  const [form, setForm] = useState<FormState>({
    implementDate: "",
    customerName: "",
    customerDept: "",
    customerEmail: "",
    customerContact: "",
    title: "",

    workType: "outside",
    transportType: "company_car",

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

  useEffect(() => {
    if (id) {
      fetchReportDetail(id)
        .then((data) => {
          if (userName && data.userName !== userName) {
            alert("수정 권한이 없습니다.");
            router.back();
            return;
          }

          // 기간 파싱 로직
          // 출장 기간은 "YYYY-MM-DD ~ YYYY-MM-DD" 형식이므로 분리
          let pStart = "",
            pEnd = "";
          if (data.tripPeriod) {
            const parts = data.tripPeriod.split(" ~ ");
            if (parts.length === 2) {
              pStart = parts[0].trim().replace(" ", "T"); // datetime-local 호환
              pEnd = parts[1].trim().replace(" ", "T");
            }
          }

          setForm({
            implementDate: data.implementDate || "",
            customerName: data.customerName || "",
            customerDept: data.customerDept || "",
            customerEmail: data.customerEmail || "",
            customerContact: data.customerContact || "",
            title: data.title,

            workType: data.workType || "outside",
            transportType: data.transportType || "company_car",

            usageDate: data.usageDate ? data.usageDate.replace(" ", "T") : "",
            periodStart: pStart,
            periodEnd: pEnd,

            vehicleModel: data.vehicleModel || "",

            costBus: data.transportCosts?.bus || 0,
            costSubway: data.transportCosts?.subway || 0,
            costTaxi: data.transportCosts?.taxi || 0,
            costOther: data.transportCosts?.other || 0,

            tripDestination: data.tripDestination || "",
            tripCompanions: data.tripCompanions || "",
            tripExpenses:
              data.tripExpenses && data.tripExpenses.length > 0
                ? data.tripExpenses
                : [{ date: "", detail: "" }],
          });

          setContent(data.content || "");
        })
        .catch((err) => {
          console.error(err);
          alert("데이터를 불러오는데 실패했습니다.");
          router.back();
        })
        .finally(() => setIsFetching(false));
    }
  }, [id, userName, router]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  // 경비 내역 핸들러
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

    if (!form.title || !form.customerName) {
      return alert("필수 항목(제목, 고객사)을 입력해주세요.");
    }

    if (form.workType === "outside" && !form.usageDate) {
      return alert("외근 일시를 입력해주세요.");
    }

    setIsLoading(true);

    const tripPeriodString = `${form.periodStart.replace(
      "T",
      " "
    )} ~ ${form.periodEnd.replace("T", " ")}`;

    const payload = {
      id,
      userName,
      approvalType: "integrated_outside",
      title: form.title, // 말머리는 유지하거나 재설정하지 않음 (사용자 입력 존중)
      content,

      workType: form.workType,
      transportType: form.transportType,
      implementDate: form.implementDate,

      customerName: form.customerName,
      customerDept: form.customerDept,
      customerEmail: form.customerEmail,
      customerContact: form.customerContact,

      usageDate:
        form.workType === "outside" ? form.usageDate.replace("T", " ") : null,
      tripPeriod: form.workType === "trip" ? tripPeriodString : null,

      tripDestination: form.workType === "trip" ? form.tripDestination : null,
      tripCompanions: form.workType === "trip" ? form.tripCompanions : null,
      tripExpenses: form.workType === "trip" ? form.tripExpenses : [],

      vehicleModel:
        form.transportType === "company_car" ||
        form.transportType === "personal_car"
          ? form.vehicleModel
          : null,
      transportCosts:
        form.transportType === "public"
          ? {
              bus: form.costBus,
              subway: form.costSubway,
              taxi: form.costTaxi,
              other: form.costOther,
            }
          : null,
    };

    try {
      const res = await fetch("/api/approvals/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("수정 실패");
      alert("수정되었습니다.");
      router.push(`/main/workoutside/approvals/${id}`);
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) return <div className="p-10 text-center">불러오는 중...</div>;

  return (
    <div className="p-8 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-6">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">📝 신청서 수정</h2>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border rounded hover:bg-gray-100 text-sm"
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
                기안 일자
              </label>
              <input
                type="text"
                disabled
                className="w-full border p-2 rounded bg-gray-100 text-gray-400"
                value="수정 불가"
              />
            </div>
          </div>

          {/* 기간 입력 */}
          <div>
            <label className="block font-bold mb-1 text-gray-700">
              {form.workType === "outside" ? "외근 일시" : "출장 기간"}{" "}
              <span className="text-red-500">*</span>
            </label>
            {form.workType === "outside" ? (
              <input
                type="datetime-local"
                name="usageDate"
                value={form.usageDate}
                onChange={handleChange}
                className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e] bg-white"
              />
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  type="datetime-local"
                  name="periodStart"
                  value={form.periodStart}
                  onChange={handleChange}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e] bg-white"
                />
                <span className="text-gray-500 font-bold">~</span>
                <input
                  type="datetime-local"
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
        <div className="bg-white p-5 rounded-lg border border-gray-200 space-y-4">
          <div className="flex items-center gap-6">
            <span className="font-bold w-20 text-gray-800">구분</span>
            <label className="flex items-center gap-2 cursor-pointer hover:text-[#519d9e]">
              <input
                type="radio"
                checked={form.workType === "outside"}
                onChange={() =>
                  setForm((prev) => ({ ...prev, workType: "outside" }))
                }
                className="w-4 h-4 accent-[#519d9e]"
              />
              외근
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-[#519d9e]">
              <input
                type="radio"
                checked={form.workType === "trip"}
                onChange={() =>
                  setForm((prev) => ({ ...prev, workType: "trip" }))
                }
                className="w-4 h-4 accent-[#519d9e]"
              />
              출장
            </label>
          </div>

          <div className="h-px bg-gray-200"></div>

          <div className="flex items-center gap-6">
            <span className="font-bold w-20 text-gray-800">이동방법</span>
            {TRANSPORT_OPTIONS.map((opt) => (
              <label
                key={opt.val}
                className="flex items-center gap-2 cursor-pointer hover:text-[#519d9e]"
              >
                <input
                  type="radio"
                  checked={form.transportType === opt.val}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      transportType: opt.val as TransportType,
                    }))
                  }
                  className="w-4 h-4 accent-[#519d9e]"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* 3. 방문고객 상세정보 */}
        <div className="border-t pt-4">
          <h3 className="font-bold text-lg mb-4 text-[#519d9e] border-l-4 border-[#519d9e] pl-2">
            방문고객 상세정보
          </h3>

          {/* 출장일 때만 표시 */}
          {form.workType === "trip" && (
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
                부서명
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
                이메일
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
                이름 (담당자) <span className="text-red-500">*</span>
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
              {form.workType === "outside" ? "외근 내용" : "출장 목적"} (제목){" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              className="w-full border p-2 rounded font-bold"
            />
          </div>
        </div>

        {/* 4. 이동수단별 추가 정보 */}
        {(form.transportType === "company_car" ||
          form.transportType === "personal_car") && (
          <div className="bg-blue-50 p-4 rounded border border-blue-200 mt-2">
            <h4 className="font-bold text-blue-800 mb-2">🚙 차량 정보</h4>
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
            {form.transportType === "company_car" && (
              <div className="border rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                <h4 className="font-bold mb-2">📌 법인차량 이용수칙</h4>
                <ul className="list-decimal list-inside space-y-1 text-xs text-gray-600">
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
                <div className="mt-4 border-t pt-2 text-center">
                  <span className="text-xs font-bold text-gray-500">
                    ※ 최초 작성 시 위 이용수칙에 동의하였습니다.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {form.transportType === "public" && (
          <div className="bg-green-50 p-4 rounded border border-green-200 mt-2">
            <h4 className="font-bold text-green-800 mb-2">
              🚌 대중교통 비용 (예상)
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

        {/* 5. 출장 경비 (출장일 경우) */}
        {form.workType === "trip" && (
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
            상세 내용 (계획 등)
          </label>
          <Editor content={content} onChange={setContent} />
        </div>

        <div className="flex justify-end gap-3 border-t pt-4 mt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 font-bold text-gray-700 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-[#519d9e] text-white rounded font-bold hover:bg-[#407f80] transition-colors shadow-md"
          >
            {isLoading ? "제출 중..." : "수정 완료"}
          </button>
        </div>
      </form>
    </div>
  );
}
