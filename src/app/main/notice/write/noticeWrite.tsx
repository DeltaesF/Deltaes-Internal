"use client";

import { useState } from "react";
import { useSelector } from "react-redux"; // Redux 연결
import { RootState } from "@/store";

type Props = {
  onCancel: () => void;
};

export default function NoticeWrite({ onCancel }: Props) {
  const { userName } = useSelector(
    (state: RootState) => state.auth || { userName: "사용자" }
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCancel = () => {
    const confirmExit = window.confirm(
      "작성 중인 내용이 저장되지 않을 수 있습니다. 정말 나가시겠습니까?"
    );
    if (confirmExit) {
      onCancel();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 유효성 검사
    if (!userName) return alert("로그인 정보가 없습니다.");
    if (!title) return alert("제목을 입력해주세요.");

    setIsLoading(true);

    try {
      let fileUrl = "";

      // 1. 파일 업로드 로직 (파일이 있을 때만)
      if (file) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch("/api/notice/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error(`파일 업로드 실패: ${uploadRes.status}`);
        }

        const uploadData = await uploadRes.json();
        fileUrl = uploadData.fileUrl;
      }

      // 2. 보고서 저장 API 호출
      // userName은 Redux에서 가져온 값을 그대로 보냅니다.
      const createRes = await fetch("/api/notice/create", {
        method: "POST",
        body: JSON.stringify({
          userName, // 로그인된 사용자 이름 자동 입력
          title,
          content,
          fileUrl,
          fileName: file ? file.name : "",
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json();
        throw new Error(errData.error || "공지사항 저장 실패");
      }

      alert("공지사항이 저장되었습니다!");
      onCancel(); // 목록으로 돌아가기
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleCancel}
        className="mb-4 px-4 py-2 border rounded cursor-pointer"
      >
        ◀ 나가기
      </button>

      <h2>공지사항 작성</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="공지사항 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 rounded"
        />
        <textarea
          placeholder="공지사항 내용"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="border p-2 rounded h-40 resize-none"
        ></textarea>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-gray-600">
            첨부파일
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="border p-2 rounded cursor-pointer bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`px-4 py-2 rounded text-white font-bold transition-colors ${
            isLoading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#519d9e] hover:bg-[#407f80] cursor-pointer"
          }`}
        >
          {isLoading ? "저장 중..." : "작성 완료"}
        </button>
      </form>
    </div>
  );
}
