"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Editor from "@/components/editor";

const getTodayString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
};

export default function VehicleReportWritePage() {
  const router = useRouter();
  const { userName } = useSelector((state: RootState) => state.auth);

  const [docType, setDocType] = useState<"vehicle" | "business_trip">(
    "vehicle"
  );

  const [form, setForm] = useState({
    title: "", // 외근 목적 (제목)
    contact: "", // 연락처
    isExternalWork: false, // 외근 체크
    isVehicleUse: false, // 차량사용 체크
    isPersonalVehicle: false, // 개인차량 사용 체크
    implementDate: "", // 시행일자
    vehicleModel:
      "스타리아 377주 7412(법인차량) / 개인차량 or 대중교통 이용 시에도 기재필수", // 기본값
    usageStart: "", // 사용일시 시작
    usageEnd: "", // 사용일시 종료
  });

  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 새로고침 방지
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // [수정] onCancel 대신 router.back() 사용
  const handleCancel = () => {
    const confirmExit = window.confirm(
      "작성 중인 내용이 저장되지 않을 수 있습니다. 정말 나가시겠습니까?"
    );
    if (confirmExit) {
      router.back(); // 뒤로가기 (리스트로 이동)
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (type: "external" | "company" | "personal") => {
    setForm((prev) => ({
      ...prev,
      isExternalWork: type === "external",
      isVehicleUse: type === "company",
      isPersonalVehicle: type === "personal",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title || !form.contact || !form.usageStart || !form.usageEnd) {
      return alert("필수 항목을 모두 입력해주세요.");
    }

    // 사용일시 문자열 조합 (2026년 00월 00일 오전 0시 ~ 오후 0시 형식)
    const usagePeriod = `${form.usageStart.replace(
      "T",
      " "
    )} ~ ${form.usageEnd.replace("T", " ")}`;

    // 제목 말머리 자동 추가 로직
    const prefix = docType === "vehicle" ? "[외근/차량]" : "[출장]";
    const finalTitle = `${prefix} ${form.title}`;
    setIsLoading(true);

    try {
      const res = await fetch("/api/approvals/create", {
        method: "POST",
        body: JSON.stringify({
          userName,
          approvalType: docType, // ✅ 선택된 문서 타입 전송 ("vehicle" | "business_trip")
          title: finalTitle, // ✅ 말머리가 포함된 제목
          content,

          // 추가 필드들
          contact: form.contact,
          isExternalWork: form.isExternalWork,
          isVehicleUse: form.isVehicleUse,
          isPersonalVehicle: form.isPersonalVehicle,
          implementDate: form.implementDate,
          vehicleModel: form.vehicleModel,
          usagePeriod: usagePeriod,
        }),
      });

      if (!res.ok) throw new Error("저장 실패");

      alert("신청서가 제출되었습니다.");
      router.push("/main/workoutside/approvals/vehicle");
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-6">
      <button
        onClick={handleCancel}
        className="mb-4 px-4 py-2 border rounded hover:bg-gray-100 cursor-pointer text-sm"
      >
        ◀ 취소하고 돌아가기
      </button>

      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">
          {docType === "vehicle"
            ? "외근 및 법인차량 이용 신청서"
            : "출장 보고서 작성"}
        </h2>
        {/* ✅ 문서 종류 선택 드롭다운 */}
        <select
          value={docType}
          onChange={(e) =>
            setDocType(e.target.value as "vehicle" | "business_trip")
          }
          className="border p-2 rounded-lg bg-gray-50 font-bold text-gray-700 cursor-pointer focus:ring-2 focus:ring-[#519d9e] outline-none"
        >
          <option value="vehicle">외근/차량신청서</option>
          <option value="business_trip">출장보고서</option>
        </select>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 1. 기본 정보 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-gray-700">신청자</span>
            <input
              type="text"
              value={userName || ""}
              readOnly
              className="border p-2 rounded bg-gray-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-gray-700">
              연락처 <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              name="contact"
              value={form.contact}
              onChange={handleChange}
              placeholder="예: 010-1234-5678"
              className="border p-2 rounded focus:ring-2 focus:ring-[#519d9e]"
            />
          </div>
        </div>

        {/* 2. 구분 (체크박스) */}
        <div className="flex gap-6 items-center bg-gray-50 p-4 rounded-lg border">
          <span className="text-sm font-bold text-gray-700">구분:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="workType"
              checked={form.isExternalWork}
              onChange={() => handleTypeChange("external")}
              className="w-5 h-5 accent-[#519d9e]"
            />
            <span>외근 (차량미사용)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="workType"
              checked={form.isVehicleUse}
              onChange={() => handleTypeChange("company")}
              className="w-5 h-5 accent-[#519d9e]"
            />
            <span>법인차량</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="workType"
              checked={form.isPersonalVehicle}
              onChange={() => handleTypeChange("personal")}
              className="w-5 h-5 accent-[#519d9e]"
            />
            <span>개인차량</span>
          </label>
        </div>

        {/* 3. 날짜 및 차량 정보 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              기안일자
            </label>
            <input
              type="text"
              value={getTodayString()}
              readOnly
              className="w-full border p-2 rounded bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              시행일자
            </label>
            <input
              type="date"
              name="implementDate"
              value={form.implementDate}
              onChange={handleChange}
              className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e]"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            이용차량 (텍스트 수정 가능합니다.)
          </label>
          <input
            type="text"
            name="vehicleModel"
            value={form.vehicleModel}
            onChange={handleChange}
            className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e]"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            {docType === "vehicle" ? "외근/차량 사용일시" : "출장 기간"}{" "}
            <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="datetime-local"
              name="usageStart"
              value={form.usageStart}
              onChange={handleChange}
              className="border p-2 rounded flex-1"
            />
            <span>~</span>
            <input
              type="datetime-local"
              name="usageEnd"
              value={form.usageEnd}
              onChange={handleChange}
              className="border p-2 rounded flex-1"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            제목 ({docType === "vehicle" ? "외근 목적" : "출장 목적"}){" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="예: 거래처 미팅 및 현장 점검"
            className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e]"
          />
        </div>

        {/* 4. 상세 내용 (에디터) */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            상세 내용
          </label>
          <Editor content={content} onChange={setContent} />
        </div>

        {/* 5. 이용 수칙 (법인차량 선택 시 또는 항상 노출) */}
        <div className="border rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
          <h4 className="font-bold mb-2">📌 법인차량 이용수칙</h4>
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
              사고 발생 시 법인(070-8255-6004)에 보고 후 이용자가 처리비용 부담
            </li>
            <li>
              도로교통법 등의 위반으로 인한 과태료 및 기타 법적인 책임은 이용자
              임을 유의
            </li>
            <li>
              기타 사고 및 고장 발생 시 이용자가 수리비용과 기타정비에 대한
              책임을 짐
            </li>
            <li>위의 사항은 결재 후 임의로 변경할 수 없음</li>
          </ul>
          <div className="mt-4 flex items-center gap-2 border-t pt-2">
            <p>※ 위 작성자는 법인차량 이용수칙을 확인하고 동의하였습니다.</p>
          </div>
          <p className="text-right mt-2 text-[14px] text-gray-700">
            신청인: {userName}
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 rounded text-gray-700 font-bold hover:bg-gray-300 cursor-pointer"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-[#519d9e] text-white rounded font-bold hover:bg-[#407f80] shadow-md cursor-pointer"
          >
            {isLoading ? "제출 중..." : "결재 요청"}
          </button>
        </div>
      </form>
    </div>
  );
}
