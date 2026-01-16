"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Editor from "@/components/editor"; // Editor 컴포넌트 경로 확인 필요

// 상세 내용 가져오기 (재사용)
const fetchDailyDetail = async (id: string) => {
  const res = await fetch(`/api/notice/${id}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export default function DailyEditPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { userName } = useSelector((state: RootState) => state.auth);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [existingFile, setExistingFile] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // 기존 데이터 불러오기
  useEffect(() => {
    if (id) {
      fetchDailyDetail(id)
        .then((data) => {
          // 권한 체크: 작성자가 아니면 쫓아냄
          if (userName && data.userName !== userName) {
            alert("수정 권한이 없습니다.");
            router.back();
            return;
          }
          setTitle(data.title);
          setContent(data.content);
          if (data.fileUrl) {
            setExistingFile({ name: data.fileName, url: data.fileUrl });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return alert("제목과 내용을 입력해주세요.");

    setIsLoading(true);

    try {
      let fileUrl = "";
      let fileName = "";

      // 1. 새 파일이 있으면 업로드
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/notice/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("파일 업로드 실패");
        const uploadData = await uploadRes.json();
        fileUrl = uploadData.fileUrl;
        fileName = file.name;
      }

      // 2. 업데이트 요청
      const res = await fetch("/api/notice/update", {
        method: "POST",
        body: JSON.stringify({
          id,
          userName, // 경로 찾기용
          title,
          content,
          fileUrl: fileUrl || undefined, // 새 파일 없으면 undefined (기존 유지)
          fileName: fileName || undefined,
        }),
      });

      if (!res.ok) throw new Error("수정 실패");

      alert("수정되었습니다.");
      router.push(`/main/notice/${id}`); // 상세 페이지로 이동
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) return <div className="p-8">데이터 불러오는 중...</div>;

  return (
    <div className="p-6 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">공지사항 수정</h2>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border rounded hover:bg-gray-100 text-sm cursor-pointer"
        >
          취소
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <input
          type="text"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-3 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-[#519d9e]"
        />

        <div className="min-h-[400px]">
          <Editor content={content} onChange={setContent} />
        </div>

        <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-lg">
          <label className="text-sm font-semibold text-gray-600">
            첨부파일
          </label>

          {existingFile && !file && (
            <div className="flex items-center gap-2 text-sm text-blue-600 mb-2">
              <span>현재 파일: {existingFile.name}</span>
              <button
                type="button"
                onClick={() => setExistingFile(null)} // 파일 삭제(교체 준비)
                className="text-red-500 text-xs border border-red-200 px-2 py-0.5 rounded hover:bg-red-50"
              >
                삭제/변경
              </button>
            </div>
          )}

          {(!existingFile || file) && (
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="border p-2 rounded bg-white"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`px-4 py-3 rounded text-white font-bold transition-colors shadow-md cursor-pointer ${
            isLoading ? "bg-gray-400" : "bg-[#519d9e] hover:bg-[#407f80]"
          }`}
        >
          {isLoading ? "수정 중..." : "수정 완료"}
        </button>
      </form>
    </div>
  );
}
