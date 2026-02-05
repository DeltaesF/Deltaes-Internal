"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Editor from "@/components/editor";
import { useQueryClient } from "@tanstack/react-query";

// 상세 데이터 조회 API
const fetchReportDetail = async (id: string) => {
  const res = await fetch("/api/report/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export default function BusinessReportEditPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userName } = useSelector((state: RootState) => state.auth);

  const [form, setForm] = useState({
    docNumber: "",
    title: "", // 출장 목적
    tripDestination: "",
    tripCompanions: "",
    tripPeriodStart: "",
    tripPeriodEnd: "",
    createdAt: "",
  });

  // 경비 데이터 (배열)
  const [expenses, setExpenses] = useState<{ date: string; detail: string }[]>([
    { date: "", detail: "" },
  ]);

  const [content, setContent] = useState("");

  // 파일 관리
  const [newFiles, setNewFiles] = useState<File[]>([]); // 새로 추가할 파일들
  const [existingFiles, setExistingFiles] = useState<
    { name: string; url: string }[]
  >([]); // 기존에 저장된 파일들

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // 데이터 불러오기
  useEffect(() => {
    if (id) {
      fetchReportDetail(id)
        .then((data) => {
          if (userName && data.userName !== userName) {
            alert("수정 권한이 없습니다.");
            router.back();
            return;
          }

          // 출장 기간 분리 (YYYY-MM-DD ~ YYYY-MM-DD)
          let start = "",
            end = "";
          if (data.tripPeriod) {
            const parts = data.tripPeriod.split(" ~ ");
            if (parts.length === 2) {
              start = parts[0].trim();
              end = parts[1].trim();
            }
          }

          // 생성일 포맷
          let createdDateStr = "";
          if (data.createdAt) {
            const d = new Date(data.createdAt);
            createdDateStr = `${d.getFullYear()}-${String(
              d.getMonth() + 1
            ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          }

          setForm({
            docNumber: data.docNumber || "",
            title: data.title,
            tripDestination: data.tripDestination || "",
            tripCompanions: data.tripCompanions || "",
            tripPeriodStart: start,
            tripPeriodEnd: end,
            createdAt: createdDateStr,
          });

          // 경비 데이터 설정
          if (data.tripExpenses && Array.isArray(data.tripExpenses)) {
            setExpenses(data.tripExpenses);
          }

          setContent(data.content || "");

          // 기존 파일 설정 (attachments가 있으면 쓰고, 없으면 fileUrl 하위호환)
          if (data.attachments && data.attachments.length > 0) {
            setExistingFiles(data.attachments);
          } else if (data.fileUrl) {
            setExistingFiles([{ name: data.fileName, url: data.fileUrl }]);
          }
        })
        .catch((err) => {
          console.error(err);
          alert("데이터를 불러오는데 실패했습니다.");
          router.back();
        })
        .finally(() => setIsFetching(false));
    }
  }, [id, userName, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // --- 경비 관련 핸들러 ---
  const addExpenseRow = () => {
    setExpenses([...expenses, { date: "", detail: "" }]);
  };

  const removeExpenseRow = (index: number) => {
    // 기존 데이터가 1개뿐이면 지우지 않거나 빈 값으로 초기화 (정책에 따라 결정)
    if (expenses.length === 1) {
      setExpenses([{ date: "", detail: "" }]);
      return;
    }
    const newExpenses = expenses.filter((_, i) => i !== index);
    setExpenses(newExpenses);
  };

  const handleExpenseChange = (
    index: number,
    field: "date" | "detail",
    value: string
  ) => {
    const newExpenses = [...expenses];
    newExpenses[index][field] = value;
    setExpenses(newExpenses);
  };

  // --- 파일 관련 핸들러 ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // 기존 선택된 파일들에 추가 (또는 덮어쓰기 - 여기서는 추가 방식)
      setNewFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingFile = (index: number) => {
    setExistingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // --- 제출 핸들러 ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.tripDestination)
      return alert("필수 항목을 입력해주세요.");

    setIsLoading(true);

    try {
      // 1. 새 파일 업로드
      const uploadedAttachments: { name: string; url: string }[] = [];

      for (const file of newFiles) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/report/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          uploadedAttachments.push({
            name: file.name,
            url: uploadData.fileUrl,
          });
        }
      }

      // 2. 최종 첨부파일 목록 합치기 (기존 유지된 파일 + 새로 업로드된 파일)
      const finalAttachments = [...existingFiles, ...uploadedAttachments];

      // 3. 기간 및 경비 정리
      const tripPeriod = `${form.tripPeriodStart} ~ ${form.tripPeriodEnd}`;
      const validExpenses = expenses.filter((e) => e.date && e.detail); // 빈 행 제외

      // 4. 업데이트 요청
      const res = await fetch("/api/report/update", {
        method: "POST",
        body: JSON.stringify({
          id,
          userName,
          title: form.title,
          content,

          // 출장 필드
          tripDestination: form.tripDestination,
          tripCompanions: form.tripCompanions,
          tripPeriod: tripPeriod,
          tripExpenses: validExpenses,

          // 파일 필드 (다중)
          attachments: finalAttachments,
          // 하위 호환성 (첫 번째 파일)
          fileUrl: finalAttachments.length > 0 ? finalAttachments[0].url : "",
          fileName: finalAttachments.length > 0 ? finalAttachments[0].name : "",
        }),
      });

      if (!res.ok) throw new Error("수정 실패");

      // ✅ [중요] router.refresh() 대신 이걸 사용하세요!
      // 'reports'로 시작하는 모든 쿼리(목록)를 즉시 최신화합니다.
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      await queryClient.invalidateQueries({ queryKey: ["reportDetail", id] });

      alert("수정되었습니다.");
      router.push(`/main/report/${id}`);
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching)
    return <div className="p-10 text-center">데이터 불러오는 중...</div>;

  return (
    <div className="p-8 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-6 mb-20">
      <div className="flex justify-between items-end border-b pb-4 mb-6">
        <button
          onClick={() => router.back()}
          className="mb-4 px-4 py-2 border rounded hover:bg-gray-100 text-sm cursor-pointer"
        >
          취소
        </button>
        <h2 className="text-3xl font-bold text-gray-800">
          외근 및 출장 보고서 수정
        </h2>
        <div className="text-right text-sm text-gray-500">
          <p>문서 번호 : {form.docNumber}</p>
          <p>보고 일자 : {form.createdAt}</p>
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
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* 보고 내용 (에디터) */}
        <div>
          <h3 className="text-lg font-bold mb-2">보고 내용 (출장 성과)</h3>
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
                    />
                  </td>
                  <td className="border p-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeExpenseRow(idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 파일 첨부 관리 */}
        <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-lg">
          <label className="text-sm font-semibold text-gray-600">
            첨부파일
          </label>

          {/* 1. 기존 파일 목록 */}
          {existingFiles.length > 0 && (
            <ul className="mb-2 space-y-1">
              {existingFiles.map((file, idx) => (
                <li
                  key={`ex-${idx}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="text-blue-600">📎 {file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeExistingFile(idx)}
                    className="text-xs text-red-500 border border-red-200 px-1 rounded hover:bg-red-50"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* 2. 새 파일 추가 */}
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="border p-2 rounded bg-white"
          />

          {/* 3. 새로 추가된 파일 목록 (업로드 대기) */}
          {newFiles.length > 0 && (
            <ul className="mt-2 space-y-1">
              {newFiles.map((file, idx) => (
                <li
                  key={`new-${idx}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="text-green-600">
                    ➕ {file.name} (추가됨)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeNewFile(idx)}
                    className="text-xs text-gray-500 border px-1 rounded hover:bg-gray-100"
                  >
                    취소
                  </button>
                </li>
              ))}
            </ul>
          )}
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
            {isLoading ? "수정 중..." : "수정 완료"}
          </button>
        </div>
      </form>
    </div>
  );
}
