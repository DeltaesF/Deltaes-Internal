"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

const fetchDetail = async (id: string) => {
  const res = await fetch("/api/report/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export default function ReportDetailPage() {
  const { id } = useParams() as { id: string };
  const { userName } = useSelector((state: RootState) => state.auth);
  const router = useRouter();

  const { data: report, isLoading } = useQuery({
    queryKey: ["reportDetail", id],
    queryFn: () => fetchDetail(id),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-10 text-center">로딩 중...</div>;
  if (!report)
    return <div className="p-10 text-center">데이터를 찾을 수 없습니다.</div>;

  // ✅ [핵심] 보고서 타입에 따라 제목과 목록 경로 결정
  const isExternal = report.reportType === "external_edu";

  const pageTitle = isExternal ? "외부 교육 보고서" : "사내 교육 보고서";
  const listPath = isExternal
    ? "/main/report/external"
    : "/main/report/internal";

  // 수정 페이지 경로도 구분 (혹은 수정 페이지도 하나로 합칠 수 있음)
  const editPath = isExternal
    ? `/main/report/external/edit/${id}`
    : `/main/report/internal/edit/${id}`;

  return (
    <div className="p-8 border rounded-xl bg-white shadow-sm w-4xl mx-auto mt-2 h-auto">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        {/* 동적 제목 표시 */}
        <h2 className="text-2xl font-bold text-gray-800">{pageTitle}</h2>
        <div className="flex gap-2">
          {/* 동적 목록 경로 이동 */}
          <Link
            href={listPath}
            className="px-3 py-1.5 border rounded hover:bg-gray-100 text-sm flex items-center"
          >
            목록으로
          </Link>

          {userName === report.userName && (
            <Link
              href={editPath}
              className="px-3 py-1.5 bg-[#519d9e] text-white rounded hover:bg-[#407f80] text-sm"
            >
              수정
            </Link>
          )}
        </div>
      </div>

      <div className="mb-3">
        <h3 className="text-xl font-semibold text-gray-700">{report.title}</h3>
      </div>

      {/* 테이블 형태의 정보 표시 (공통 양식) */}
      <table className="w-full border-collapse border border-gray-300 mb-8 text-sm">
        <tbody>
          <tr>
            <th className="bg-gray-100 border p-3">작성자</th>
            <td className="border p-3" colSpan={3}>
              {report.userName}
            </td>
          </tr>
          <tr>
            <th className="bg-gray-100 border p-3">교육명</th>
            <td className="border p-3" colSpan={3}>
              {report.educationName}
            </td>
          </tr>
          <tr>
            <th className="bg-gray-100 border p-3">교육 기간</th>
            <td className="border p-3">{report.educationPeriod}</td>
            <th className="bg-gray-100 border p-3">교육 시간</th>
            <td className="border p-3">{report.educationTime}</td>
          </tr>
          <tr>
            <th className="bg-gray-100 border p-3">교육 장소</th>
            <td className="border p-3" colSpan={3}>
              {report.educationPlace}
            </td>
          </tr>
          <tr>
            <th className="bg-gray-100 border p-3">유용성</th>
            <td className="border p-3" colSpan={3}>
              <span className="font-bold text-[#519d9e]">
                {report.usefulness}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mb-4">
        <h3 className="text-lg font-bold mb-2 border-l-4 border-[#519d9e] pl-2">
          교육 내용 요약
        </h3>
        <div
          className="prose-editor min-h-[200px] p-4 bg-gray-50 rounded-lg border"
          dangerouslySetInnerHTML={{ __html: report.content }}
        />
      </div>
    </div>
  );
}
