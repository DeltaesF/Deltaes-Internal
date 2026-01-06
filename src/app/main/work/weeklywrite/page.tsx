"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; // router 사용
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Editor from "@/components/editor";

// ✅ [추가] 오늘 날짜 문자열 생성 함수 (YYYY.MM.DD)
const getTodayString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
};

const DEFAULT_TEMPLATE = `
  <h3>금주 업무 보고</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 40%;">추진사항</th>
        <th style="width: 20%;">완료예정일</th>
        <th style="width: 40%;">상세내용</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <ul>
            <li></li>
          </ul>
        </td>
        <td>
          <ul>
            <li></li>
          </ul>
        </td>
        <td>
          <ul>
            <li></li>
          </ul>
        </td>
      </tr>
    </tbody>
  </table>
`;

export default function WeeklyWritePage() {
  const router = useRouter(); // 라우터 훅 사용
  const { userName } = useSelector(
    (state: RootState) => state.auth || { userName: "사용자" }
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState(DEFAULT_TEMPLATE);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ [추가] 페이지 로드 시 제목 자동 설정
  useEffect(() => {
    if (userName) {
      const dateStr = getTodayString();
      // 포맷: 일일업무보고_2026.01.01
      setTitle(`주간업무보고_${dateStr}_${userName}`);
    }
  }, [userName]);

  // [수정] onCancel 대신 router.back() 사용
  const handleCancel = () => {
    const confirmExit = window.confirm(
      "작성 중인 내용이 저장되지 않을 수 있습니다. 정말 나가시겠습니까?"
    );
    if (confirmExit) {
      router.back(); // 뒤로가기 (리스트로 이동)
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName) return alert("로그인 정보가 없습니다.");
    if (!title) return alert("제목을 입력해주세요.");

    setIsLoading(true);

    try {
      let fileUrl = "";
      // 1. 파일 업로드
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/weekly/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("파일 업로드 실패");
        const uploadData = await uploadRes.json();
        fileUrl = uploadData.fileUrl;
      }

      // 2. 게시글 저장
      const createRes = await fetch("/api/weekly/create", {
        method: "POST",
        body: JSON.stringify({
          userName,
          title,
          content,
          fileUrl,
          fileName: file ? file.name : "",
        }),
      });

      if (!createRes.ok) throw new Error("저장 실패");

      alert("보고서가 저장되었습니다!");

      // [수정] 작성 완료 후 리스트 페이지로 이동
      router.push("/main/work/weekly");
      // router.refresh(); // 필요하다면 데이터 갱신을 위해 추가
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

      <h2 className="text-2xl font-bold mb-6">📅 주간 업무 보고서 작성</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* 입력 폼 내용 (기존과 동일) */}
        <input
          type="text"
          placeholder="주간업무보고서_2026.01.01_홍길동"
          value={title}
          readOnly
          className="border p-2 rounded"
        />
        {/* [변경] 기존 textarea 대신 Editor 컴포넌트 사용 */}
        <div className="min-h-[400px]">
          <Editor content={content} onChange={setContent} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-gray-600">
            첨부파일
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="border p-2 rounded"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`px-4 py-3 rounded text-white font-bold transition-colors cursor-pointer ${
            isLoading ? "bg-gray-400" : "bg-[#519d9e] hover:bg-[#407f80]"
          }`}
        >
          {isLoading ? "저장 중..." : "작성 완료"}
        </button>
      </form>
    </div>
  );
}
