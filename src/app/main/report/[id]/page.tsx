"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useState } from "react";

// ✅ [1] 타입 정의 (Strict Typing)
interface ReportDetail {
  id: string;
  reportType: string;
  title: string;
  content: string;
  userName: string;
  department: string;
  position: string;
  status: string; // 결재 상태 확인용
  approvers?: {
    // 결재선 정보
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };

  // ✅ [추가] 결재 이력 타입
  approvalHistory?: {
    approver: string;
    status: string;
    comment?: string;
    approvedAt:
      | { seconds?: number; _seconds?: number }
      | string
      | number
      | Date;
  }[];

  // 교육 보고서용 필드
  educationName?: string;
  educationPeriod?: string;
  educationTime?: string;
  educationPlace?: string;
  usefulness?: string;
  // 출장 보고서용 필드
  tripDestination?: string;
  tripCompanions?: string;
  tripPeriod?: string;
  tripExpenses?: { date: string; detail: string }[];
  docNumber?: string;
  // 파일
  fileUrl?: string;
  fileName?: string;
  attachments?: { name: string; url: string }[];
  createdAt: number;
}

const fetchDetail = async (id: string): Promise<ReportDetail> => {
  const res = await fetch("/api/report/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export default function InternalReportDetailPage() {
  const { id } = useParams() as { id: string };
  const { userName } = useSelector((state: RootState) => state.auth);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [comment, setComment] = useState("");

  const { data: report, isLoading } = useQuery<ReportDetail>({
    queryKey: ["reportDetail", id],
    queryFn: () => fetchDetail(id),
    enabled: !!id,
  });

  // ✅ [수정] 결재 승인/반려 Mutation (이메일 발송을 위해 update API 사용)
  const approveMutation = useMutation({
    mutationFn: async ({ status }: { status: "approve" | "reject" }) => {
      if (!report) throw new Error("Report not found");

      // 1. 현재 내 역할(1차/2차/3차) 확인
      const myName = userName || "";
      const isFirst = report.approvers?.first?.includes(myName);
      const isSecond = report.approvers?.second?.includes(myName);
      const isThird = report.approvers?.third?.includes(myName);

      // ✅ [추가] 다음 결재자 존재 여부 확인
      const hasSecondApprover =
        report.approvers?.second && report.approvers.second.length > 0;
      const hasThirdApprover =
        report.approvers?.third && report.approvers.third.length > 0;

      // 2. 다음 상태값 계산
      let nextStatus = "반려"; // 기본값 (status === 'reject'일 때 사용)

      if (status === "approve") {
        // [1차 결재자]
        if (isFirst && report.status === "1차 결재 대기") {
          if (hasSecondApprover) {
            nextStatus = "2차 결재 대기";
          } else {
            nextStatus = "결재 완료"; // 2차 없으면 끝
          }
        }
        // [2차 결재자]
        else if (isSecond && report.status === "2차 결재 대기") {
          if (hasThirdApprover) {
            nextStatus = "3차 결재 대기";
          } else {
            nextStatus = "결재 완료"; // 3차 없으면 끝
          }
        }
        // [3차 결재자]
        else if (isThird && report.status === "3차 결재 대기") {
          nextStatus = "결재 완료";
        } else {
          console.warn("결재 권한이 없거나 순서가 아닙니다.");
          return;
        }
      }

      // 3. update API 호출 (이메일 자동 발송됨)
      const res = await fetch("/api/report/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id,
          userName: report.userName,
          status: nextStatus,

          // ✅ [추가] 결재자 실명 전송 (이력 저장용)
          approverName: userName,

          // ✅ [추가] 코멘트 전송
          comment: comment,
        }),
      });

      if (!res.ok) throw new Error("처리 실패");
      return res.json();
    },
    onSuccess: (_, { status }) => {
      alert(status === "approve" ? "승인되었습니다." : "반려되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["reportDetail", id] });
      router.push("/main/my-approval/pending");
    },
    onError: (err) => {
      console.error(err);
      alert("오류가 발생했습니다.");
    },
  });

  if (isLoading) return <div className="p-10 text-center">로딩 중...</div>;
  if (!report)
    return <div className="p-10 text-center">데이터를 찾을 수 없습니다.</div>;

  // ✅ [수정] 결재 권한 확인 로직 (내 차례인지 확인)
  const myName = userName || "";
  const isFirstApprover = report.approvers?.first?.includes(myName);
  const isSecondApprover = report.approvers?.second?.includes(myName);
  const isThirdApprover = report.approvers?.third?.includes(myName);

  const isPendingFirst = report.status === "1차 결재 대기";
  const isPendingSecond = report.status === "2차 결재 대기";
  const isPendingThird = report.status === "3차 결재 대기";

  // 내가 결재자 명단에 있고, 현재 상태가 내 순서일 때만 true
  const canApprove =
    (isFirstApprover && isPendingFirst) ||
    (isSecondApprover && isPendingSecond) ||
    (isThirdApprover && isPendingThird);

  // 보고서 타입 확인 및 경로 설정
  const isExternal = report.reportType === "external_edu";
  const isInternal = report.reportType === "internal_edu";
  const isBusiness = report.reportType === "business_trip";

  let pageTitle = "사내 교육 보고서";
  let listPath = "/main/report/internal";
  let editPath = `/main/report/internal/edit/${id}`;

  if (isExternal) {
    pageTitle = "외부 교육 보고서";
    listPath = "/main/report/external";
    editPath = `/main/report/external/edit/${id}`;
  } else if (isInternal) {
    pageTitle = "사내 교육 보고서";
    listPath = "/main/report/internal";
    editPath = `/main/report/internal/edit/${id}`;
  } else if (isBusiness) {
    pageTitle = "외근 및 출장 보고서";
    listPath = "/main/workoutside/approvals/vehicle";
    editPath = `/main/report/business/edit/${id}`;
  }

  return (
    <div className="p-8 border rounded-xl bg-white shadow-sm w-4xl mx-auto mt-6 mb-20 h-auto">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">{pageTitle}</h2>
        <div className="flex gap-2">
          <Link
            href={listPath}
            prefetch={false}
            className="px-3 py-1.5 border rounded hover:bg-gray-100 text-sm flex items-center"
          >
            목록으로
          </Link>
          {userName === report.userName && (
            <Link
              href={editPath}
              prefetch={false}
              className="px-3 py-1.5 bg-[#519d9e] text-white rounded hover:bg-[#407f80] text-sm"
            >
              수정
            </Link>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          {report.title}
        </h3>
      </div>

      {/* 테이블 렌더링 (이전과 동일) */}
      {isBusiness ? (
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
          {isBusiness ? "보고 내용 (출장 성과)" : "상세 내용 요약"}
        </h3>
        <div
          className="prose-editor min-h-[200px] p-4 bg-gray-50 rounded-lg border"
          dangerouslySetInnerHTML={{ __html: report.content }}
        />
      </div>

      {isBusiness && (
        <>
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
                  {report.tripExpenses.map((ex, idx) => (
                    <tr key={idx}>
                      <td className="border p-2 text-center">{ex.date}</td>
                      <td className="border p-2">{ex.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(report.fileUrl ||
            (report.attachments && report.attachments.length > 0)) && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm font-bold text-gray-600 mb-2">
                파일 첨부 (증빙자료)
              </p>
              <div className="flex flex-col gap-2">
                {report.fileUrl && !report.attachments && (
                  <a
                    href={report.fileUrl}
                    target="_blank"
                    className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                  >
                    📎 {report.fileName || "다운로드"}
                  </a>
                )}
                {report.attachments?.map((file, idx) => (
                  <a
                    key={idx}
                    href={file.url}
                    target="_blank"
                    className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                  >
                    📎 {file.name}
                  </a>
                ))}
              </div>
            </div>
          )}
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

      {/* ---------------------------------------------------------------- */}
      {/* ✅ [추가] 결재 진행 이력 및 코멘트 표시 영역 (품의서와 동일 스타일) */}
      {/* ---------------------------------------------------------------- */}
      {report.approvalHistory && report.approvalHistory.length > 0 && (
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            📋 결재 진행 이력
          </h3>
          <div className="space-y-4">
            {report.approvalHistory.map((history, idx) => {
              let dateStr = "";
              const at = history.approvedAt;

              try {
                if (!at) {
                  dateStr = "-";
                } else if (
                  typeof at === "object" &&
                  "seconds" in at &&
                  typeof at.seconds === "number"
                ) {
                  dateStr = new Date(at.seconds * 1000).toLocaleString();
                } else if (
                  typeof at === "object" &&
                  "_seconds" in at &&
                  typeof at._seconds === "number"
                ) {
                  dateStr = new Date(at._seconds * 1000).toLocaleString();
                } else {
                  const d = new Date(at as string | number | Date);
                  if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleString();
                  } else {
                    dateStr = "날짜 오류";
                  }
                }
              } catch {
                dateStr = "-";
              }

              const isReject = history.status.includes("반려");
              const badgeClass = isReject
                ? "bg-red-100 text-red-700 border-red-200"
                : "bg-blue-100 text-blue-700 border-blue-200";

              return (
                <div
                  key={idx}
                  className="bg-white border rounded-lg p-4 shadow-sm border-l-4 border-l-gray-400"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-base">
                        {history.approver}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded border font-bold ${badgeClass}`}
                      >
                        {history.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">
                      {dateStr}
                    </span>
                  </div>
                  {history.comment && (
                    <div className="mt-3 p-3 bg-gray-50 border rounded text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      <span className="font-bold text-[#519d9e] mr-2">
                        💬 의견:
                      </span>
                      {history.comment}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ✅ [수정] 결재 권한이 있을 때만 표시 (canApprove) */}
      {canApprove && (
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">✅ 결재 처리</h3>
          <div className="bg-gray-50 p-6 rounded-xl border">
            <label className="block text-gray-700 font-bold mb-2 text-sm">
              결재 의견 (선택)
            </label>
            <textarea
              className="w-full border p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#519d9e] resize-none bg-white"
              placeholder="반려 사유 또는 코멘트를 입력하세요."
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  if (confirm("반려하시겠습니까?"))
                    approveMutation.mutate({ status: "reject" });
                }}
                disabled={approveMutation.isPending}
                className="px-6 py-2.5 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors shadow-sm disabled:bg-gray-400 cursor-pointer"
              >
                반려
              </button>
              <button
                onClick={() => {
                  if (confirm("승인하시겠습니까?"))
                    approveMutation.mutate({ status: "approve" });
                }}
                disabled={approveMutation.isPending}
                className="px-8 py-2.5 bg-[#519d9e] text-white rounded-lg font-bold hover:bg-[#407f80] transition-colors shadow-sm disabled:bg-gray-400 cursor-pointer"
              >
                승인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
