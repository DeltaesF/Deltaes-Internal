"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

interface WeeklyDetail {
  id: string;
  title: string;
  content: string;
  userName: string;
  createdAt: number;
  fileUrl?: string;
  fileName?: string;
}

const fetchWeeklyDetail = async (id: string) => {
  const res = await fetch(`/api/weekly/${id}`);
  if (!res.ok) throw new Error("Fetch failed");
  return res.json();
};

export default function WeeklyDetailPage() {
  const { id } = useParams() as { id: string };
  const { userName } = useSelector((state: RootState) => state.auth);

  const { data: weekly, isLoading } = useQuery<WeeklyDetail>({
    queryKey: ["weeklyDetail", id],
    queryFn: () => fetchWeeklyDetail(id),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8 text-center">로딩 중...</div>;
  if (!weekly)
    return <div className="p-8 text-center">글을 찾을 수 없습니다.</div>;

  return (
    <div className="p-8 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-6">
      <div className="flex justify-between items-center mb-4">
        <Link
          href="/main/work/weekly"
          className="px-3 py-1 border rounded-lg hover:bg-gray-100 text-sm"
        >
          ← 목록으로
        </Link>

        {/* ✅ 작성자 본인일 경우 수정 버튼 노출 */}
        {userName === weekly.userName && (
          <div className="flex gap-2">
            <Link
              href={`/main/work/weekly/edit/${id}`}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              수정
            </Link>
          </div>
        )}
      </div>

      <h2 className="text-3xl font-bold mb-4">{weekly.title}</h2>

      <div className="flex items-center text-sm text-gray-500 mb-8 pb-4 border-b gap-4">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-gray-700">작성자:</span>
          <span className="text-gray-900">{weekly.userName}</span>
        </div>
        <div className="w-[1px] h-3 bg-gray-300"></div>
        <div>{new Date(weekly.createdAt).toLocaleString()}</div>
      </div>

      <div
        className="prose-editor max-w-none text-gray-800 leading-relaxed min-h-[200px]"
        dangerouslySetInnerHTML={{ __html: weekly.content }}
      />

      {weekly.fileUrl && (
        <div className="mt-10 pt-6 border-t">
          <p className="text-sm text-gray-600 mb-2 font-semibold">첨부파일</p>
          <a
            href={weekly.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-blue-700 rounded-lg transition-colors no-underline"
          >
            <span className="truncate max-w-xs">
              {weekly.fileName || "첨부파일 다운로드"}
            </span>
          </a>
        </div>
      )}
    </div>
  );
}
