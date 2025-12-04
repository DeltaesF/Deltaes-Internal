"use client";

type DailyDetailProps = {
  daily: {
    id: string;
    title: string;
    content: string;
    userName: string;
    fileUrl?: string | null;
    fileName?: string | null;
    createdAt: number;
  };
  onBack: () => void;
};

export default function DailyDetail({ daily, onBack }: DailyDetailProps) {
  return (
    <div className="p-6 border rounded-xl bg-white shadow-sm">
      <button
        onClick={onBack}
        className="mb-4 px-3 py-1 border rounded-lg hover:bg-gray-300 cursor-pointer"
      >
        ← 뒤로가기
      </button>

      <h2 className="text-2xl font-bold mb-3">{daily.title}</h2>
      <div className="flex items-center text-sm text-gray-500 mb-6 pb-4 border-b gap-4">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-gray-700">작성자:</span>
          <span className="text-gray-900">{daily.userName}</span>
        </div>
        <div className="w-[1px] h-3 bg-gray-300"></div>
        <div>{new Date(daily.createdAt).toLocaleString()}</div>
      </div>

      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: daily.content }}
      />

      {daily.fileUrl && (
        <div className="mt-8 pt-4 border-t">
          <p className="text-sm text-gray-600 mb-2 font-semibold">첨부파일</p>
          <a
            href={daily.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-blue-700 rounded-lg transition-colors no-underline"
          >
            {/* 파일 아이콘 (선택사항) */}
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>

            {/* [수정] 파일 이름이 있으면 이름 표시, 없으면 '첨부파일 다운로드' */}
            <span className="truncate max-w-xs">
              {daily.fileName || "첨부파일 다운로드"}
            </span>
          </a>
        </div>
      )}
    </div>
  );
}
