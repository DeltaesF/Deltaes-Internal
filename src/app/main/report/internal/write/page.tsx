"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Editor from "@/components/editor";

// ✅ 오늘 날짜 포맷 함수 (YYYY.MM.DD)
const getTodayString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
};

export default function InternalReportWritePage() {
  const router = useRouter();
  const { userName } = useSelector((state: RootState) => state.auth);

  const [form, setForm] = useState({
    title: "", // 초기값 비워둠 (useEffect에서 설정)
    educationName: "",
    startDate: "",
    endDate: "",
    educationPlace: "",
    educationTime: "",
    usefulness: "보통",
  });
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ✅ [1] 페이지 진입 시 제목 자동 설정 (수정 불가)
  useEffect(() => {
    const today = getTodayString();
    setForm((prev) => ({
      ...prev,
      title: `Delta ES 사내교육보고서_${today}`,
    }));
  }, []);

  // ✅ [2] 새로고침/탭 닫기 방지 (작성 중 이탈 방지)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // 크롬 등 브라우저 표준 동작
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ✅ [3] 취소/뒤로가기 핸들러 (컨펌 창 띄우기)
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
          reportType: "internal_edu",
          title: form.title, // 자동 생성된 제목 전송
          content,

          educationName: form.educationName,
          educationPeriod: `${form.startDate} ~ ${form.endDate}`,
          educationPlace: form.educationPlace,
          educationTime: form.educationTime,
          usefulness: form.usefulness,
        }),
      });

      if (!res.ok) throw new Error("저장 실패");

      alert("보고서가 작성되었습니다.");
      router.push("/main/report/internal");
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-6">
      {/* ✅ [4] 상단 뒤로가기 버튼 추가 */}
      <button
        onClick={handleCancel}
        className="mb-4 px-4 py-2 border rounded hover:bg-gray-100 cursor-pointer text-sm text-gray-600 transition-colors"
      >
        ◀ 취소하고 돌아가기
      </button>

      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        사내 교육 보고서 작성
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
            {/* readOnly 적용 및 스타일 변경 */}
            <input
              type="text"
              name="title"
              value={form.title}
              readOnly
              className="w-full border p-2 rounded bg-gray-100 text-gray-600 focus:outline-none cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                교육 기간
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleChange}
                  className="border p-2 rounded w-full"
                />
                <span>~</span>
                <input
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleChange}
                  className="border p-2 rounded w-full"
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
                placeholder="예: 13:00 ~ 16:20, 10:00 ~ 12:00"
                className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e] outline-none"
              />
            </div>
          </div>
        </div>

        {/* 3. 유용성 평가 */}
        <div className="border p-4 rounded-lg">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            업무 수행상 유용성
          </label>
          <div className="flex gap-6">
            {["매우좋음", "좋음", "보통", "부족", "매우부족"].map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 cursor-pointer"
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
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            교육 내용 요약
          </label>
          <Editor content={content} onChange={setContent} />
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={handleCancel} // ✅ [5] 하단 취소 버튼에도 핸들러 적용
            className="px-4 py-2 bg-gray-200 rounded text-gray-700 font-bold hover:bg-gray-300 transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-[#519d9e] text-white rounded font-bold hover:bg-[#407f80] transition-colors shadow-md cursor-pointer"
          >
            {isLoading ? "저장 중..." : "작성 완료"}
          </button>
        </div>
      </form>
    </div>
  );
}
