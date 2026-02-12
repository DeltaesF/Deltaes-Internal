"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Editor from "@/components/editor";
import { useQueryClient } from "@tanstack/react-query";

const getTodayString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
};

export default function ExternalReportWritePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userName } = useSelector((state: RootState) => state.auth);

  const [form, setForm] = useState({
    title: "",
    educationName: "",
    startDate: "",
    endDate: "",
    educationPlace: "",
    educationTime: "",
    usefulness: "보통",
  });
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const today = getTodayString();
    setForm((prev) => ({
      ...prev,
      title: `Delta ES 외부교육보고서_${today}_${userName}`, // ✅ 제목 자동 설정 (외부)
    }));
  }, []);

  // 새로고침 방지
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleCancel = () => {
    const confirmExit = window.confirm(
      "작성 중인 내용이 저장되지 않을 수 있습니다. 정말 나가시겠습니까?"
    );
    if (confirmExit) {
      router.back();
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.educationName || !form.startDate) {
      return alert("필수 항목을 모두 입력해주세요.");
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/report/create", {
        method: "POST",
        body: JSON.stringify({
          userName,
          reportType: "external_edu", // ✅ 외부 교육 보고서 타입 지정
          title: form.title,
          content,

          educationName: form.educationName,
          educationPeriod: `${form.startDate} ~ ${form.endDate}`,
          educationPlace: form.educationPlace,
          educationTime: form.educationTime,
          usefulness: form.usefulness,
        }),
      });

      if (!res.ok) throw new Error("저장 실패");

      // ✅ [수정 포인트]
      // 'reports' 키로 시작하는 모든 목록 데이터(사내, 사외, 업무 보고 등)를 무효화합니다.
      // 이렇게 해야 목록 페이지로 이동했을 때 방금 쓴 글이 새로고침 없이 보입니다.
      await queryClient.invalidateQueries({
        queryKey: ["reports"],
        exact: false,
      });

      alert("보고서가 작성되었습니다.");
      router.push("/main/report/external"); // 작성 후 외부 보고서 목록으로 이동
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-4 md:mt-6">
      {/* 상단 뒤로가기 버튼 - 모바일 터치 편의성 유지 */}
      <button
        onClick={handleCancel}
        className="mb-4 px-4 py-2 border rounded hover:bg-gray-100 cursor-pointer text-sm text-gray-600 transition-colors"
      >
        ◀ 취소하고 돌아가기
      </button>

      <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-800">
        외부 교육 보고서 작성
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 1. 기본 정보 (작성자) */}
        <div className="p-4 bg-gray-50 rounded-lg border">
          <span className="block text-xs text-gray-500 mb-1">작성자</span>
          <div className="font-bold text-gray-700">{userName}</div>
        </div>

        {/* 2. 교육 정보 입력 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              보고서 제목
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              readOnly
              className="w-full border p-2 rounded bg-gray-100 text-gray-600 focus:outline-none cursor-not-allowed"
            />
          </div>

          {/* 교육명 / 교육 장소 - 태블릿(lg) 구간까지 1열 유지하여 사이드바 공간 확보 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                교육명
              </label>
              <input
                type="text"
                name="educationName"
                value={form.educationName}
                onChange={handleChange}
                className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                교육 장소
              </label>
              <input
                type="text"
                name="educationPlace"
                value={form.educationPlace}
                onChange={handleChange}
                className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e] outline-none"
              />
            </div>
          </div>

          {/* 교육 기간 / 교육 시간 - 1024px 미만 1열 처리 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                교육 기간
              </label>
              {/* 좁은 화면에서 날짜 input이 찌그러지지 않도록 flex-wrap 및 최소너비 적용 */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleChange}
                  className="border p-2 rounded flex-1 min-w-[120px] text-sm md:text-base"
                />
                <span className="shrink-0 text-gray-500">~</span>
                <input
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleChange}
                  className="border p-2 rounded flex-1 min-w-[120px] text-sm md:text-base"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                교육 시간 (총 시간)
              </label>
              <input
                type="text"
                name="educationTime"
                value={form.educationTime}
                onChange={handleChange}
                placeholder="예: 13:00 ~ 16:20"
                className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e] outline-none"
              />
            </div>
          </div>
        </div>

        {/* 3. 유용성 평가 - flex-wrap으로 모바일 줄바꿈 대응 */}
        <div className="border p-4 rounded-lg overflow-hidden">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            업무 수행상 유용성
          </label>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {["매우좋음", "좋음", "보통", "부족", "매우부족"].map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 cursor-pointer shrink-0"
              >
                <input
                  type="radio"
                  name="usefulness"
                  value={opt}
                  checked={form.usefulness === opt}
                  onChange={handleChange}
                  className="accent-[#519d9e] w-4 h-4"
                />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 4. 내용 (에디터) */}
        <div className="min-h-[300px]">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            교육 내용 요약
          </label>
          <Editor content={content} onChange={setContent} />
        </div>

        {/* 하단 버튼 영역 */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-200 rounded text-gray-700 font-bold hover:bg-gray-300 transition-colors cursor-pointer text-sm md:text-base"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-[#519d9e] text-white rounded font-bold hover:bg-[#407f80] transition-colors shadow-md cursor-pointer text-sm md:text-base disabled:bg-gray-400"
          >
            {isLoading ? "저장 중..." : "작성 완료"}
          </button>
        </div>
      </form>
    </div>
  );
}
