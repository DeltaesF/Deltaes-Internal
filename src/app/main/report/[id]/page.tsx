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
    onSuccess: async (_, { status }) => {
      // ✅ async 추가
      alert(status === "approve" ? "승인되었습니다." : "반려되었습니다.");

      // ✅ [수정 포인트 1] 모든 보고서 목록 캐시를 무효화합니다.
      // 사용자가 목록으로 돌아갔을 때 상태(결재 대기 -> 완료)가 즉시 반영됩니다.
      await queryClient.invalidateQueries({ queryKey: ["reports"] });

      // ✅ [수정 포인트 2] 현재 보고 있는 이 보고서의 상세 캐시를 무효화합니다.
      // 이렇게 해야 상세 페이지 내의 '결재 진행 이력' 테이블이 즉시 업데이트됩니다.
      await queryClient.invalidateQueries({ queryKey: ["reportDetail", id] });

      // 결재를 마쳤으므로 대기함으로 이동
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
    <div className="p-4 md:p-8 border rounded-xl bg-white shadow-sm w-full max-w-4xl mx-auto mt-4 md:mt-6 mb-20 h-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-4 gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">
          {pageTitle}
        </h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link
            href={listPath}
            prefetch={false}
            className="flex-1 sm:flex-none justify-center px-3 py-1.5 border rounded hover:bg-gray-100 text-sm flex items-center transition-colors"
          >
            목록으로
          </Link>
          {userName === report.userName && (
            <Link
              href={editPath}
              prefetch={false}
              className="flex-1 sm:flex-none justify-center px-3 py-1.5 bg-[#519d9e] text-white rounded hover:bg-[#407f80] text-sm text-center transition-colors"
            >
              수정
            </Link>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg md:text-xl font-semibold text-gray-700 mb-2 break-all leading-tight">
          {report.title}
        </h3>
      </div>

      {/* 🔹 가로로 길어지지 않게 만드는 핵심 영역 */}
      <div className="mb-8 border border-gray-300 rounded-lg overflow-hidden">
        {isBusiness ? (
          // 출장 보고서 (그리드 방식 권장)
          <div className="grid grid-cols-1 md:grid-cols-4 text-sm">
            <div className="bg-gray-100 p-3 font-bold border-b md:border-r border-gray-300">
              문서 번호
            </div>
            <div className="p-3 border-b md:border-r border-gray-300">
              {report.docNumber || "-"}
            </div>
            <div className="bg-gray-100 p-3 font-bold border-b md:border-r border-gray-300">
              보고 일자
            </div>
            <div className="p-3 border-b border-gray-300">
              {new Date(report.createdAt).toLocaleDateString()}
            </div>

            <div className="bg-gray-100 p-3 font-bold border-b md:border-r border-gray-300">
              보고자
            </div>
            <div className="p-3 border-b md:border-r border-gray-300">
              {report.userName}
            </div>
            <div className="bg-gray-100 p-3 font-bold border-b md:border-r border-gray-300">
              소속
            </div>
            <div className="p-3 border-b border-gray-300">
              {report.department}
            </div>

            <div className="bg-gray-100 p-3 font-bold border-b md:border-r border-gray-300">
              출장지
            </div>
            <div className="p-3 border-b md:border-r border-gray-300">
              {report.tripDestination}
            </div>
            <div className="bg-gray-100 p-3 font-bold border-b md:border-r border-gray-300">
              동행출장자
            </div>
            <div className="p-3 border-b border-gray-300">
              {report.tripCompanions || "-"}
            </div>

            <div className="bg-gray-100 p-3 font-bold border-b md:border-r border-gray-300">
              출장 기간
            </div>
            <div className="p-3 border-b border-gray-300 md:col-span-3">
              {report.tripPeriod}
            </div>

            <div className="bg-gray-100 p-3 font-bold md:border-r border-gray-300">
              출장 목적
            </div>
            <div className="p-3 md:col-span-3">{report.title}</div>
          </div>
        ) : (
          // 교육 보고서 (그리드 방식 권장)
          <div className="grid grid-cols-1 md:grid-cols-4 text-sm">
            <div className="bg-gray-100 p-3 font-bold border-b md:border-r border-gray-300">
              작성자
            </div>
            <div className="p-3 border-b md:border-r border-gray-300">
              {report.userName}
            </div>
            <div className="bg-gray-100 p-3 font-bold border-b md:border-r border-gray-300">
              소속
            </div>
            <div className="p-3 border-b border-gray-300">
              {report.department}
            </div>

            <div className="bg-gray-100 p-3 font-bold border-b md:border-r border-gray-300">
              교육명
            </div>
            <div className="p-3 border-b border-gray-300 md:col-span-3">
              {report.educationName}
            </div>

            <div className="bg-gray-100 p-3 font-bold border-b md:border-r border-gray-300">
              교육 기간
            </div>
            <div className="p-3 border-b md:border-r border-gray-300">
              {report.educationPeriod}
            </div>
            <div className="bg-gray-100 p-3 font-bold border-b md:border-r border-gray-300">
              교육 시간
            </div>
            <div className="p-3 border-b border-gray-300">
              {report.educationTime}
            </div>

            <div className="bg-gray-100 p-3 font-bold border-b md:border-r border-gray-300">
              교육 장소
            </div>
            <div className="p-3 border-b border-gray-300 md:col-span-3">
              {report.educationPlace}
            </div>

            <div className="bg-gray-100 p-3 font-bold md:border-r border-gray-300">
              유용성
            </div>
            <div className="p-3 md:col-span-3">
              <span className="font-bold text-[#519d9e]">
                {report.usefulness}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4">
        <h3 className="text-base md:text-lg font-bold mb-2 border-l-4 border-[#519d9e] pl-2">
          {isBusiness ? "보고 내용 (출장 성과)" : "상세 내용 요약"}
        </h3>
        <div
          className="prose-editor min-h-[200px] p-3 md:p-4 bg-gray-50 rounded-lg border text-sm md:text-base"
          dangerouslySetInnerHTML={{ __html: report.content }}
        />
      </div>

      {/* 출장 경비 테이블도 모바일에서 세로 리스트로 보이게 처리 가능하지만 
        간단한 표이므로 가로폭 100% 유지 */}
      {isBusiness && (
        <>
          {report.tripExpenses && report.tripExpenses.length > 0 && (
            <div className="mb-8 mt-6">
              <h3 className="text-base md:text-lg font-bold mb-2 border-l-4 border-[#519d9e] pl-2">
                출장 경비
              </h3>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs md:text-sm">
                  <thead className="bg-gray-100 border-b border-gray-300">
                    <tr>
                      <th className="p-2 border-r border-gray-300 w-1/3">
                        일자
                      </th>
                      <th className="p-2">비용 내역</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300">
                    {report.tripExpenses.map((ex, idx) => (
                      <tr key={idx}>
                        <td className="p-2 border-r border-gray-300 text-center">
                          {ex.date}
                        </td>
                        <td className="p-2 break-all">{ex.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* ... (첨부파일 및 하단 서명란 생략, 이전 답변과 동일 구조) ... */}
        </>
      )}

      {/* ... (결재 이력 및 결재 처리 영역 생략) ... */}
    </div>
  );
}
