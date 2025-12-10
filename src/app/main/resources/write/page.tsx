"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

export default function ResourcesWritePage() {
  const router = useRouter();
  const { userName } = useSelector((state: RootState) => state.auth);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return alert("제목을 입력해주세요.");
    setIsLoading(true);

    try {
      let fileUrl = "";
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const upRes = await fetch("/api/resources/upload", {
          method: "POST",
          body: formData,
        });
        if (upRes.ok) {
          const data = await upRes.json();
          fileUrl = data.fileUrl;
        }
      }

      const res = await fetch("/api/resources/create", {
        method: "POST",
        body: JSON.stringify({
          userName,
          title,
          content,
          fileUrl,
          fileName: file?.name,
        }),
      });

      if (!res.ok) throw new Error("저장 실패");
      alert("자료가 등록되었습니다.");
      router.push("/main/resources");
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
        onClick={() => router.back()}
        className="mb-4 px-4 py-2 border rounded hover:bg-gray-100"
      >
        ← 취소
      </button>
      <h2 className="text-xl font-bold mb-4">📢 자료실 작성</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="제목"
          className="border p-2 rounded"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="내용"
          className="border p-2 rounded h-40"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <input
          type="file"
          className="border p-2"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-[#519d9e] text-white py-2 rounded font-bold hover:bg-[#407f80]"
        >
          {isLoading ? "저장 중..." : "작성 완료"}
        </button>
      </form>
    </div>
  );
}
