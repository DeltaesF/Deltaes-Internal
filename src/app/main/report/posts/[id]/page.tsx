import { db } from "@/lib/firebaseAdmin";
import Link from "next/link";
import { notFound } from "next/navigation";

async function getReportDetail(id: string) {
  try {
    const snapshot = await db.collectionGroup("userReports").get();
    const doc = snapshot.docs.find((d) => d.id === id);
    if (!doc) return null;
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      content: data.content,
      userName: data.userName,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      createdAt: data.createdAt?.toMillis
        ? data.createdAt.toMillis()
        : data.createdAt || Date.now(),
    };
  } catch (error) {
    console.error("Error fetching daily detail:", error);
    return null;
  }
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReportDetail(id);
  if (!report) return notFound();

  return (
    <div className="p-6 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-6">
      <Link
        href="/main/report/posts"
        className="inline-block mb-4 px-3 py-1 border rounded-lg hover:bg-gray-100 text-sm"
      >
        ← 목록으로
      </Link>
      <h2 className="text-2xl font-bold mb-3">{report.title}</h2>
      <div className="flex items-center text-sm text-gray-500 mb-6 pb-4 border-b gap-4">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-gray-700">작성자:</span>
          <span>{report.userName}</span>
        </div>
        <div className="w-[1px] h-3 bg-gray-300"></div>
        <div>{new Date(report.createdAt).toLocaleString()}</div>
      </div>
      <div
        className="prose max-w-none whitespace-pre-wrap"
        dangerouslySetInnerHTML={{ __html: report.content }}
      />
      {report.fileUrl && (
        <div className="mt-8 pt-4 border-t">
          <p className="text-sm font-semibold mb-2">첨부파일</p>
          <a
            href={report.fileUrl}
            target="_blank"
            className="text-blue-600 hover:underline"
          >
            {report.fileName || "다운로드"}
          </a>
        </div>
      )}
    </div>
  );
}
