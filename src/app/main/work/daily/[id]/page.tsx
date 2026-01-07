"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

// 타입 정의
interface DailyDetail {
  id: string;
  title: string;
  content: string;
  userName: string;
  createdAt: number;
  fileUrl?: string;
  fileName?: string;
}

const fetchDailyDetail = async (id: string) => {
  const res = await fetch(`/api/daily/${id}`);
  if (!res.ok) throw new Error("Fetch failed");
  return res.json();
};

export default function DailyDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter(); // router 추가
  // role 추가
  const { userName, role } = useSelector((state: RootState) => state.auth);

  const { data: daily, isLoading } = useQuery<DailyDetail>({
    queryKey: ["dailyDetail", id],
    queryFn: () => fetchDailyDetail(id),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8 text-center">로딩 중...</div>;
  if (!daily)
    return <div className="p-8 text-center">글을 찾을 수 없습니다.</div>;

  // ✅ [권한 체크] : 슈퍼바이저, 관리자 이거나, 작성자 본인일 때만 내용을 보여줌
  const isAuthorized =
    role === "supervisor" || role === "admin" || daily.userName === userName;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-6 bg-white border rounded-2xl shadow-sm mx-auto max-w-2xl mt-10 p-10">
        <div className="text-6xl">🚫</div>
        <h2 className="text-2xl font-bold text-gray-800">
          접근 권한이 없습니다
        </h2>
        <p className="text-gray-500 text-center">
          다른 직원의 상세 업무 보고 내용은 열람할 수 없습니다.
          <br />
          본인의 보고서만 확인 가능합니다.
        </p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
        >
          뒤로가기
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-6">
      {/* 상단 버튼 영역 */}
      <div className="flex justify-between items-center mb-4">
        <Link
          href="/main/work/daily"
          className="px-3 py-1 border rounded-lg hover:bg-gray-100 text-sm"
        >
          ← 목록으로
        </Link>

        {/* ✅ 작성자 본인인 경우에만 수정 버튼 노출 */}
        {userName === daily.userName && (
          <div className="flex gap-2">
            <Link
              href={`/main/work/daily/edit/${id}`}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              수정
            </Link>
          </div>
        )}
      </div>

      <h2 className="text-3xl font-bold mb-4">{daily.title}</h2>

      <div className="flex items-center text-sm text-gray-500 mb-8 pb-4 border-b gap-4">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-gray-700">작성자:</span>
          <span className="text-gray-900">{daily.userName}</span>
        </div>
        <div className="w-[1px] h-3 bg-gray-300"></div>
        <div>{new Date(daily.createdAt).toLocaleString()}</div>
      </div>

      {/* 에디터 스타일 적용 */}
      <div
        className="prose-editor max-w-none text-gray-800 leading-relaxed min-h-[200px]"
        dangerouslySetInnerHTML={{ __html: daily.content }}
      />

      {daily.fileUrl && (
        <div className="mt-10 pt-6 border-t">
          <p className="text-sm text-gray-600 mb-2 font-semibold">첨부파일</p>
          <a
            href={daily.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-blue-700 rounded-lg transition-colors no-underline"
          >
            <span className="truncate max-w-xs">
              {daily.fileName || "첨부파일 다운로드"}
            </span>
          </a>
        </div>
      )}
    </div>
  );
}
