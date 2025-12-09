"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; // router 사용
import { useSelector } from "react-redux";
import { RootState } from "@/store";

// Props 타입 정의 제거 (page.tsx는 props를 받지 않음)

export default function ApprovalsWritePage() {
  const router = useRouter(); // 라우터 훅 사용
  const { userName } = useSelector(
    (state: RootState) => state.auth || { userName: "사용자" }
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
        const uploadRes = await fetch("/api/approvals/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("파일 업로드 실패");
        const uploadData = await uploadRes.json();
        fileUrl = uploadData.fileUrl;
      }

      // 2. 게시글 저장
      const createRes = await fetch("/api/approvals/create", {
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
      router.push("/work/approvals");
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

      <h2 className="text-2xl font-bold mb-6">품의서 작성</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* 입력 폼 내용 (기존과 동일) */}
        <input
          type="text"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 rounded"
        />
        <textarea
          placeholder="내용"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="border p-2 rounded h-40 resize-none"
        ></textarea>

        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="border p-2 rounded"
        />

        <button
          type="submit"
          disabled={isLoading}
          className={`px-4 py-3 rounded text-white font-bold transition-colors ${
            isLoading ? "bg-gray-400" : "bg-[#519d9e] hover:bg-[#407f80]"
          }`}
        >
          {isLoading ? "저장 중..." : "작성 완료"}
        </button>
      </form>
    </div>
  );
}
