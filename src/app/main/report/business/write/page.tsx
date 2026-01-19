"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Editor from "@/components/editor";

// 오늘 날짜 (YYYY-MM-DD)
const getTodayDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// 문서 번호용 날짜 (YYYYMMDD)
const getDocDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

export default function BusinessReportWritePage() {
  const router = useRouter();
  const { userName, role } = useSelector((state: RootState) => state.auth);

  // 문서 번호 생성 (제 DES 20260120-1 호)
  const docNumberInitial = `제 DES ${getDocDate()}-1 호`;

  const [form, setForm] = useState({
    docNumber: docNumberInitial,
    tripDestination: "",
    tripCompanions: "",
    tripPeriodStart: "",
    tripPeriodEnd: "",
    title: "", // 출장 목적
  });

  const [expenses, setExpenses] = useState<{ date: string; detail: string }[]>([
    { date: "", detail: "" },
  ]);

  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 작성자 소속 (Redux에 부서 정보가 없다면 API로 가져오거나 하드코딩 필요)
  // 여기서는 편의상 UI에 표시만 함
  const department = ""; // 예시 (실제로는 API에서 가져오거나 AuthSlice에 추가 필요)

  // 경비 행 추가
  const addExpenseRow = () => {
    setExpenses([...expenses, { date: "", detail: "" }]);
  };

  // 경비 행 삭제
  const removeExpenseRow = (index: number) => {
    if (expenses.length === 1) return;
    const newExpenses = expenses.filter((_, i) => i !== index);
    setExpenses(newExpenses);
  };

  // 경비 입력 핸들러
  const handleExpenseChange = (
    index: number,
    field: "date" | "detail",
    value: string
  ) => {
    const newExpenses = [...expenses];
    newExpenses[index][field] = value;
    setExpenses(newExpenses);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.title ||
      !form.tripDestination ||
      !form.tripPeriodStart ||
      !form.tripPeriodEnd
    ) {
      return alert("필수 항목을 모두 입력해주세요.");
    }

    setIsLoading(true);

    try {
      let fileUrl = "";
      let fileName = "";

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/report/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("파일 업로드 실패");
        const uploadData = await uploadRes.json();
        fileUrl = uploadData.fileUrl;
        fileName = file.name;
      }

      const tripPeriod = `${form.tripPeriodStart} ~ ${form.tripPeriodEnd}`;

      // 빈 경비 행 제거
      const validExpenses = expenses.filter((e) => e.date && e.detail);

      const res = await fetch("/api/report/create", {
        method: "POST",
        body: JSON.stringify({
          userName,
          reportType: "business_trip", // ✅ 출장 보고서 타입
          title: form.title, // 출장 목적을 title로 사용
          content,
          fileUrl,
          fileName,

          // 출장 전용 필드
          docNumber: form.docNumber,
          tripDestination: form.tripDestination,
          tripCompanions: form.tripCompanions,
          tripPeriod: tripPeriod,
          tripExpenses: validExpenses,
        }),
      });

      if (!res.ok) throw new Error("저장 실패");

      alert("출장 보고서가 제출되었습니다.");
      router.push("/main/report/business");
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-6">
      <div className="flex justify-between items-end border-b pb-4 mb-6">
        <h2 className="text-3xl font-bold text-gray-800">
          외근 및 출장 보고서
        </h2>
        <div className="text-right text-sm text-gray-700">
          <p>문서 번호 : {form.docNumber}</p>
          <p>보고 일자 : {getTodayDate()}</p>
          <p>보 고 자 : {userName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 상단 정보 테이블 */}
        <table className="w-full border-collapse border border-gray-300 text-sm">
          <tbody>
            <tr>
              <th className="bg-gray-100 border p-3 w-32">출장지</th>
              <td className="border p-3">
                <input
                  type="text"
                  name="tripDestination"
                  value={form.tripDestination}
                  onChange={handleChange}
                  className="w-full outline-none"
                  placeholder="예: 서울 삼성전자 본사"
                />
              </td>
              <th className="bg-gray-100 border p-3 w-32">동행출장자</th>
              <td className="border p-3">
                <input
                  type="text"
                  name="tripCompanions"
                  value={form.tripCompanions}
                  onChange={handleChange}
                  className="w-full outline-none"
                  placeholder="예: 홍길동, 김철수"
                />
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-3">출장 기간</th>
              <td className="border p-3" colSpan={3}>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    name="tripPeriodStart"
                    value={form.tripPeriodStart}
                    onChange={handleChange}
                    className="border p-1 rounded"
                  />
                  <span>~</span>
                  <input
                    type="date"
                    name="tripPeriodEnd"
                    value={form.tripPeriodEnd}
                    onChange={handleChange}
                    className="border p-1 rounded"
                  />
                </div>
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-3">출장 목적</th>
              <td className="border p-3" colSpan={3}>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  className="w-full outline-none font-bold"
                  placeholder="출장 목적을 입력하세요 (제목으로 사용됩니다)"
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* 보고 내용 (에디터) */}
        <div>
          <h3 className="text-lg font-bold mb-2">보고 내용 (출장 성과)</h3>
          <div className="text-xs text-gray-500 mb-2">
            ※ 출장보고서는 종료일 3일 이내에 제출함을 원칙으로 합니다.
          </div>
          <Editor content={content} onChange={setContent} />
        </div>

        {/* 출장 경비 (동적 테이블) */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold">출장 경비</h3>
            <button
              type="button"
              onClick={addExpenseRow}
              className="px-2 py-1 bg-gray-100 border rounded text-xs hover:bg-gray-200"
            >
              + 행 추가
            </button>
          </div>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2 w-32">일자</th>
                <th className="border p-2">비용 내역 (항목 및 금액)</th>
                <th className="border p-2 w-16">삭제</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((item, idx) => (
                <tr key={idx}>
                  <td className="border p-2">
                    <input
                      type="date"
                      value={item.date}
                      onChange={(e) =>
                        handleExpenseChange(idx, "date", e.target.value)
                      }
                      className="w-full outline-none bg-transparent"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="text"
                      value={item.detail}
                      onChange={(e) =>
                        handleExpenseChange(idx, "detail", e.target.value)
                      }
                      className="w-full outline-none bg-transparent"
                      placeholder="예: KTX 왕복 (100,000원)"
                    />
                  </td>
                  <td className="border p-2 text-center">
                    {expenses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeExpenseRow(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 파일 첨부 */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-gray-600">
            파일 첨부 (증빙자료)
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="border p-2 rounded"
          />
        </div>

        {/* 하단 서명란 */}
        <div className="mt-10 text-center space-y-6">
          <p className="text-lg">위와 같이 사내(외) 출장보고서를 제출합니다.</p>
          <p className="text-lg font-bold">
            {getTodayDate().replace(/-/g, ". ")}
          </p>
          <div className="flex justify-center gap-10 text-lg">
            <span>출장자 : 소속 ({department})</span>
            <span>성명 : {userName} (인)</span>
          </div>
          <h2 className="text-2xl font-bold pt-6">
            주식회사 델타이에스 대표이사 귀하
          </h2>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 mt-4 border-t pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 rounded text-gray-700 font-bold hover:bg-gray-300"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-[#519d9e] text-white rounded font-bold hover:bg-[#407f80] shadow-md"
          >
            {isLoading ? "제출 중..." : "결재 요청"}
          </button>
        </div>
      </form>
    </div>
  );
}
