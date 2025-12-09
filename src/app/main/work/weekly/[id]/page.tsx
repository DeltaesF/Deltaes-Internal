import { db } from "@/lib/firebaseAdmin";
import Link from "next/link";
import { notFound } from "next/navigation";

// DB 데이터 조회 함수
async function getWeeklyDetail(id: string) {
  try {
    // userWeeklys 컬렉션 그룹 전체 스캔 (ID 매칭)
    const snapshot = await db.collectionGroup("userWeeklys").get();
    const doc = snapshot.docs.find((d) => d.id === id);

    if (!doc) return null;

    const data = doc.data();
    return {
      id: doc.id,
      title: data.title || "제목 없음",
      content: data.content || "",
      userName: data.userName || "작성자",
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      createdAt:
        data.createdAt && typeof data.createdAt.toMillis === "function"
          ? data.createdAt.toMillis()
          : data.createdAt || Date.now(),
    };
  } catch (error) {
    console.error("Error fetching weekly detail:", error);
    return null;
  }
}

export default async function WeeklyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const weekly = await getWeeklyDetail(id);

  if (!weekly) return notFound();

  return (
    <div className="p-6 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-6">
      <Link
        href="/main/work/weekly"
        className="inline-block mb-4 px-3 py-1 border rounded-lg hover:bg-gray-100 text-sm"
      >
        ← 뒤로가기
      </Link>

      <h2 className="text-2xl font-bold mb-3">{weekly.title}</h2>
      <div className="flex items-center text-sm text-gray-500 mb-6 pb-4 border-b gap-4">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-gray-700">작성자:</span>
          <span className="text-gray-900">{weekly.userName}</span>
        </div>
        <div className="w-[1px] h-3 bg-gray-300"></div>
        <div>{new Date(weekly.createdAt).toLocaleString()}</div>
      </div>

      <div
        className="prose max-w-none whitespace-pre-wrap text-gray-800 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: weekly.content }}
      />

      {weekly.fileUrl && (
        <div className="mt-8 pt-4 border-t">
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
