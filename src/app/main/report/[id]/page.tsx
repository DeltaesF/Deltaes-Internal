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
  const isVehicle = report.reportType === "vehicle_usage";
  const isExternal = report.reportType === "external_edu";
  const isInternal = report.reportType === "internal_edu";

  // 제목 및 경로 결정
  let pageTitle = "사내 교육 보고서";
  let listPath = "/main/report/internal";
  let editPath = `/main/report/internal/edit/${id}`;

  if (isVehicle) {
    pageTitle = "외근 및 법인차량 이용 신청서";
    listPath = "/main/report/vehicle";
    editPath = `/main/report/vehicle/edit/${id}`;
  } else if (isExternal) {
    pageTitle = "외부 교육 보고서";
    listPath = "/main/report/external";
    editPath = `/main/report/external/edit/${id}`;
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

      {/* ✅ [분기] 차량 보고서일 때 UI */}
      {isVehicle ? (
        <table className="w-full border-collapse border border-gray-300 mb-8 text-sm">
          <tbody>
            <tr>
              <th className="bg-gray-100 border p-3 w-32">신청자</th>
              <td className="border p-3">{report.userName}</td>
              <th className="bg-gray-100 border p-3 w-32">소속</th>
              <td className="border p-3">{report.department}</td>
            </tr>

            <tr>
              <th className="bg-gray-100 border p-3 w-32">연락처</th>
              <td className="border p-3">{report.contact || "-"}</td>
              <th className="bg-gray-100 border p-3 w-32">구분</th>
              <td className="border p-3">
                <div className="flex gap-4">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={report.isExternalWork}
                      readOnly
                      className="accent-[#519d9e]"
                    />{" "}
                    외근
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={report.isVehicleUse}
                      readOnly
                      className="accent-[#519d9e]"
                    />{" "}
                    차량사용
                  </label>
                </div>
              </td>
            </tr>

            <tr>
              <th className="bg-gray-100 border p-3">이용차량</th>
              <td className="border p-3" colSpan={3}>
                {report.vehicleModel}
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-3">시행일자</th>
              <td className="border p-3">{report.implementDate}</td>
              <th className="bg-gray-100 border p-3">사용일시</th>
              <td className="border p-3">{report.usagePeriod}</td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-3">외근 및 차량이용 목적</th>
              <td className="border p-3" colSpan={3}>
                {report.title}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        // ✅ 교육 보고서일 때 UI (기존 유지)
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

      <div className="mb-4">
        <h3 className="text-lg font-bold mb-2 border-l-4 border-[#519d9e] pl-2">
          상세 내용 요약
        </h3>
        <div
          className="prose-editor min-h-[200px] p-4 bg-gray-50 rounded-lg border"
          dangerouslySetInnerHTML={{ __html: report.content }}
        />
      </div>

      {/* 차량 보고서일 경우 하단에 이용수칙 표시 (선택사항) */}
      {isVehicle && (
        <div className="border rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
          <h4 className="font-bold mb-2">📌 법인차량 이용수칙</h4>
          <ul className="list-decimal list-inside space-y-1 text-[14px]">
            <li>개인적인 목적으로 이용 신청 불가 (*행사계획서 별첨)</li>
            <li>
              이용에 따른 유류비는 법인카드 사용 (주유한 영수증 보관
              필수/주유량과 단가 확인)
            </li>
            <li>
              운전자는 만 26세 이상 운전면허 소지자여야 함 (자동차보험
              연령한정특약 조건)
            </li>
            <li>운전자 면허증 사본 제출</li>
            <li>차량운행일지 반드시 작성 (차량에 비치되어 있음)</li>
            <li>차량은 이용자가 직접 수령, 청소 완료 후 직접 반납</li>
            <li>
              사고 발생 시 법인(070-8255-6004)에 보고 후 이용자가 처리비용 부담
            </li>
            <li>
              도로교통법 등의 위반으로 인한 과태료 및 기타 법적인 책임은 이용자
              임을 유의
            </li>
            <li>
              기타 사고 및 고장 발생 시 이용자가 수리비용과 기타정비에 대한
              책임을 짐
            </li>
            <li>위의 사항은 결재 후 임의로 변경할 수 없음</li>
          </ul>
          <div className="mt-4 flex items-center gap-2 border-t pt-2">
            <p>※ 위 작성자는 법인차량 이용수칙을 확인하고 동의하였습니다.</p>
          </div>
          <p className="text-right mt-2 text-[14px] text-gray-700">
            신청인: {userName}
          </p>
        </div>
      )}
    </div>
  );
}
