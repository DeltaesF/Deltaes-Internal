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

  // 보고서 타입 확인
  const isExternal = report.reportType === "external_edu";
  const isInternal = report.reportType === "internal_edu";
  const isBusiness = report.reportType === "business_trip";

  // 제목 및 경로 결정
  let pageTitle = "사내 교육 보고서";
  let listPath = "/main/report/internal";
  let editPath = `/main/report/internal/edit/${id}`;

  if (isExternal) {
    pageTitle = "외부 교육 보고서";
    listPath = "/main/report/external";
    editPath = `/main/report/external/edit/${id}`;
  } else if (isInternal) {
    pageTitle = "내부 교육 보고서";
    listPath = "/main/report/internal";
    editPath = `/main/report/internal/edit/${id}`;
  } else if (isBusiness) {
    pageTitle = "외근 및 출장 보고서";
    listPath = "/main/report/business";
    editPath = `/main/report/business/edit/${id}`;
  }

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

      {/* ✅ 1. 테이블 분기 (출장 vs 교육) */}
      {isBusiness ? (
        // 🛫 [출장 보고서 양식]
        <table className="w-full border-collapse border border-gray-300 mb-8 text-sm">
          <tbody>
            <tr>
              <th className="bg-gray-100 border p-3 w-32">문서 번호</th>
              <td className="border p-3">{report.docNumber || "-"}</td>
              <th className="bg-gray-100 border p-3 w-32">보고 일자</th>
              <td className="border p-3">
                {new Date(report.createdAt).toLocaleDateString()}
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-3">보고자</th>
              <td className="border p-3">{report.userName}</td>
              <th className="bg-gray-100 border p-3">소속</th>
              <td className="border p-3">{report.department}</td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-3">출장지</th>
              <td className="border p-3">{report.tripDestination}</td>
              <th className="bg-gray-100 border p-3">동행출장자</th>
              <td className="border p-3">{report.tripCompanions || "-"}</td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-3">출장 기간</th>
              <td className="border p-3" colSpan={3}>
                {report.tripPeriod}
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-3">출장 목적</th>
              <td className="border p-3" colSpan={3}>
                {report.title}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        // 📚 [교육 보고서 양식 (내부/외부)]
        <table className="w-full border-collapse border border-gray-300 mb-8 text-sm">
          <tbody>
            <tr>
              <th className="bg-gray-100 border p-3 w-32">작성자</th>
              <td className="border p-3">{report.userName}</td>
              <th className="bg-gray-100 border p-3 w-32">소속</th>
              <td className="border p-3">{report.department}</td>
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
      )}

      {/* 2. 상세 내용 (공통) */}
      <div className="mb-4">
        <h3 className="text-lg font-bold mb-2 border-l-4 border-[#519d9e] pl-2">
          {isBusiness ? "보고 내용 (출장 성과)" : "상세 내용 요약"}
        </h3>
        <div
          className="prose-editor min-h-[200px] p-4 bg-gray-50 rounded-lg border"
          dangerouslySetInnerHTML={{ __html: report.content }}
        />
      </div>

      {/* ✅ 3. 출장 보고서일 때만 표시되는 섹션 */}
      {isBusiness && (
        <>
          {/* (1) 출장 경비 */}
          {report.tripExpenses && report.tripExpenses.length > 0 && (
            <div className="mb-8 mt-6">
              <h3 className="text-lg font-bold mb-2 border-l-4 border-[#519d9e] pl-2">
                출장 경비
              </h3>
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2 w-32 text-center">일자</th>
                    <th className="border p-2 text-center">비용 내역</th>
                  </tr>
                </thead>
                <tbody>
                  {report.tripExpenses.map(
                    (ex: { date: string; detail: string }, idx: number) => (
                      <tr key={idx}>
                        <td className="border p-2 text-center">{ex.date}</td>
                        <td className="border p-2">{ex.detail}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* (2) 첨부파일 (단일/다중 모두 지원) */}
          {(report.fileUrl ||
            (report.attachments && report.attachments.length > 0)) && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm font-bold text-gray-600 mb-2">
                파일 첨부 (증빙자료)
              </p>
              <div className="flex flex-col gap-2">
                {/* 기존 단일 파일 호환 */}
                {report.fileUrl && !report.attachments && (
                  <a
                    href={report.fileUrl}
                    target="_blank"
                    className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                  >
                    📎 {report.fileName || "다운로드"}
                  </a>
                )}
                {/* 다중 파일 표시 */}
                {report.attachments?.map(
                  (file: { name: string; url: string }, idx: number) => (
                    <a
                      key={idx}
                      href={file.url}
                      target="_blank"
                      className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                    >
                      📎 {file.name}
                    </a>
                  )
                )}
              </div>
            </div>
          )}

          {/* (3) 하단 서명 */}
          <div className="mt-10 text-center space-y-4 border-t pt-8">
            <p className="text-lg">
              위와 같이 사내(외) 출장보고서를 제출합니다.
            </p>
            <p className="text-lg font-bold">
              {new Date(report.createdAt).toLocaleDateString()}
            </p>
            <div className="flex justify-center gap-4 text-base">
              <span>
                출장자 : 소속 ({report.department}) 성명 : {report.userName}
              </span>
            </div>
            <h2 className="text-xl font-bold pt-4 text-gray-800">
              주식회사 델타이에스 대표이사 귀하
            </h2>
          </div>
        </>
      )}
    </div>
  );
}
