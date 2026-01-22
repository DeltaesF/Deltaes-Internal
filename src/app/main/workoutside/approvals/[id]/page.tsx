"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useState } from "react";

// ----------------------------------------------------------------
// [1] 타입 정의 (Strict Typing)
// ----------------------------------------------------------------

// 구매 품의서용 상세 데이터 타입
interface PriceDetails {
  orig: string;
  mod: string;
}
interface PriceData {
  list: PriceDetails;
  contract: PriceDetails;
  dc: PriceDetails;
  salesNet: PriceDetails;
  profit: PriceDetails;
  warranty: PriceDetails;
  remarks: string;
}
interface CostDetails {
  act: string;
  nom: string;
  desc: string;
}
interface CostData {
  transport: CostDetails;
  warranty: CostDetails;
  travel: CostDetails;
  overseas: CostDetails;
  personnel: CostDetails;
  material: CostDetails;
  extraWarranty: CostDetails;
  rental: CostDetails;
  interest: CostDetails;
  other: CostDetails;
  subtotal: { act: string; nom: string };
  docTypes: string[];
  total: { val: string; desc: string };
}

interface ApprovalDetail {
  id: string;
  approvalType?: string; // "vehicle" | "purchase" | "sales"
  title: string;
  content: string;
  userName: string;
  department?: string;
  status: string; // 결재 상태
  createdAt: number;

  approvers?: {
    first?: string[];
    second?: string[];
    third?: string[];
    shared?: string[];
  };

  // 🚗 차량/외근용 필드
  contact?: string;
  isExternalWork?: boolean;
  isVehicleUse?: boolean;
  isPersonalVehicle?: boolean;
  vehicleModel?: string;
  implementDate?: string;
  usagePeriod?: string;
  purpose?: string;

  // 🛒 구매/판매용 필드
  serialNumber?: string;
  customerName?: string;
  product?: string;
  endUser?: string;
  customerInfo?: string;
  contractDate?: string;
  introductionType?: string;
  introductionMemo?: string;
  deliveryDate?: string;
  paymentPending?: string;
  paymentPendingAmount?: string;
  billingDate?: string;
  cashCollection?: string;
  cashCollectionDays?: string;
  collectionDate?: string;
  noteCollection?: string;
  noteCollectionDays?: string;
  noteMaturityDate?: string;
  specialNotes?: string;
  priceData?: PriceData;
  costData?: CostData;
  attachments?: { name: string; url: string }[];
}

const fetchDetail = async (id: string): Promise<ApprovalDetail> => {
  const res = await fetch("/api/approvals/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export default function ApprovalDetailPage() {
  const { id } = useParams() as { id: string };
  const { userName } = useSelector((state: RootState) => state.auth);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [comment, setComment] = useState("");

  const { data: approval, isLoading } = useQuery<ApprovalDetail>({
    queryKey: ["approvalDetail", id],
    queryFn: () => fetchDetail(id),
    enabled: !!id,
  });

  // ✅ 결재 승인/반려 Mutation
  const approveMutation = useMutation({
    mutationFn: async ({ status }: { status: "approve" | "reject" }) => {
      if (!approval) throw new Error("Document not found");

      const res = await fetch("/api/approvals/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId: id,
          approverName: userName,
          applicantUserName: approval.userName,
          status,
          comment,
        }),
      });
      if (!res.ok) throw new Error("처리 실패");
      return res.json();
    },
    onSuccess: (_, { status }) => {
      alert(status === "approve" ? "승인되었습니다." : "반려되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["approvalDetail", id] });
      router.push("/main/my-approval/pending");
    },
    onError: () => alert("오류가 발생했습니다."),
  });

  if (isLoading) return <div className="p-10 text-center">로딩 중...</div>;
  if (!approval)
    return <div className="p-10 text-center">문서를 찾을 수 없습니다.</div>;

  // ✅ 결재 권한 확인
  const myName = userName || "";
  const isFirstApprover = approval.approvers?.first?.includes(myName);
  const isSecondApprover = approval.approvers?.second?.includes(myName);
  const isThirdApprover = approval.approvers?.third?.includes(myName);

  const isPendingFirst = approval.status === "1차 결재 대기";
  const isPendingSecond = approval.status === "2차 결재 대기";
  const isPendingThird = approval.status === "3차 결재 대기";

  const canApprove =
    (isFirstApprover && isPendingFirst) ||
    (isSecondApprover && isPendingSecond) ||
    (isThirdApprover && isPendingThird);

  // 품의서 타입 및 경로 설정
  const approvalType = approval.approvalType || "purchase";
  let pageTitle = "";
  let listPath = "";
  let editPath = "";

  switch (approvalType) {
    case "vehicle":
      pageTitle = "외근 및 법인차량 이용 신청서";
      listPath = "/main/workoutside/approvals/vehicle";
      editPath = `/main/workoutside/approvals/vehicle/edit/${id}`;
      break;
    case "sales":
      pageTitle = "판매 품의서";
      listPath = "/main/workoutside/approvals/sales";
      editPath = `/main/workoutside/approvals/sales/edit/${id}`;
      break;
    case "purchase":
    default:
      pageTitle = "구매 품의서";
      listPath = "/main/workoutside/approvals/purchase";
      editPath = `/main/workoutside/approvals/purchase/edit/${id}`;
      break;
  }

  // ----------------------------------------------------------------
  // [2] 렌더링 헬퍼: 구매 품의서 뷰
  // ----------------------------------------------------------------
  const renderPurchaseView = () => (
    <div className="space-y-8 text-sm">
      {/* Table 1: 기본 정보 */}
      <table className="w-full border-collapse border border-gray-300">
        <tbody>
          <tr>
            <th className="bg-gray-100 border p-3 w-32">일련번호</th>
            <td
              className="border p-3 font-mono text-xs text-gray-600"
              colSpan={3}
            >
              {approval.serialNumber}
            </td>
          </tr>
          <tr>
            <th className="bg-gray-100 border p-3 w-32">고객명</th>
            <td className="border p-3">{approval.customerName}</td>
            <th className="bg-gray-100 border p-3 w-32">Product</th>
            <td className="border p-3">{approval.product}</td>
          </tr>
          <tr>
            <th className="bg-gray-100 border p-3">End User</th>
            <td className="border p-3">{approval.endUser}</td>
            <th className="bg-gray-100 border p-3">고객정보</th>
            <td className="border p-3">{approval.customerInfo}</td>
          </tr>
          <tr>
            <th className="bg-gray-100 border p-3">계약일</th>
            <td className="border p-3">
              <div className="mb-1">{approval.contractDate}</div>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-bold">
                {approval.introductionType}
              </span>
            </td>
            <td
              className="border p-3 bg-yellow-50 align-top whitespace-pre-wrap"
              rowSpan={3}
              colSpan={2}
            >
              {approval.introductionMemo}
            </td>
          </tr>
          <tr>
            <th className="bg-gray-100 border p-3">납품일</th>
            <td className="border p-3">
              <div className="mb-1">{approval.deliveryDate}</div>
              <div className="text-xs">
                수금 미결:{" "}
                <span className="font-bold">{approval.paymentPending}</span>
                {approval.paymentPending === "유" &&
                  ` (${approval.paymentPendingAmount}원)`}
              </div>
            </td>
          </tr>
          <tr>
            <th className="bg-gray-100 border p-3">청구일</th>
            <td className="border p-3">
              <div className="mb-1">{approval.billingDate}</div>
              <div className="text-xs">
                현금 수금:{" "}
                <span className="font-bold">{approval.cashCollection}</span> 후{" "}
                {approval.cashCollectionDays}일
              </div>
            </td>
          </tr>
          <tr>
            <th className="bg-gray-100 border p-3">수금일</th>
            <td className="border p-3">
              <div className="mb-1">{approval.collectionDate}</div>
              <div className="text-xs">
                어음 수금:{" "}
                <span className="font-bold">{approval.noteCollection}</span> 후{" "}
                {approval.noteCollectionDays}일
              </div>
            </td>
            <th className="bg-gray-100 border p-3">어음만기일</th>
            <td className="border p-3">{approval.noteMaturityDate}</td>
          </tr>
          <tr>
            <th className="bg-gray-100 border p-3" colSpan={4}>
              납품 ~ 수금관련 특기사항
            </th>
          </tr>
          <tr>
            <td
              className="border p-3 h-24 align-top whitespace-pre-wrap"
              colSpan={4}
            >
              {approval.specialNotes}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Table 2: 금액 정보 */}
      {approval.priceData && (
        <table className="w-full border-collapse border border-gray-300 text-center text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-3 w-32">구분</th>
              <th className="border p-3">원안</th>
              <th className="border p-3">수정</th>
              <th className="border p-3">비고 (통합)</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                "list",
                "contract",
                "dc",
                "salesNet",
                "profit",
                "warranty",
              ] as Array<keyof PriceData>
            ).map((key, idx) => {
              if (key === "remarks") return null;
              const rowData = approval.priceData![key] as PriceDetails;
              const labels: Record<string, string> = {
                list: "정가(원)",
                contract: "계약가(원)",
                dc: "DC 율(%)",
                salesNet: "SALES NET(원)",
                profit: "매출이익(원)",
                warranty: "Warranty",
              };
              return (
                <tr key={key}>
                  <th className="bg-gray-100 border p-3">{labels[key]}</th>
                  <td className="border p-3">{rowData.orig}</td>
                  <td className="border p-3 bg-gray-50">{rowData.mod}</td>
                  {idx === 0 && (
                    <td
                      className="border p-3 bg-yellow-50 align-top text-left whitespace-pre-wrap"
                      rowSpan={6}
                    >
                      {approval.priceData!.remarks}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Table 3: 비용 정보 */}
      {approval.costData && (
        <table className="w-full border-collapse border border-gray-300 text-center text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-3 w-32">비용 항목</th>
              <th className="border p-3">실질 투입</th>
              <th className="border p-3">명목 투입</th>
              <th className="border p-3">적요 및 산출 근거</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                "transport",
                "warranty",
                "travel",
                "overseas",
                "personnel",
                "material",
                "extraWarranty",
                "rental",
                "interest",
                "other",
              ] as Array<keyof CostData>
            ).map((key) => {
              const rowData = approval.costData![key] as CostDetails;
              const labels: Record<string, string> = {
                transport: "운송비",
                warranty: "보증 비용",
                travel: "출장 교육",
                overseas: "해외 교육",
                personnel: "인원 지원",
                material: "설치 자재비",
                extraWarranty: "초가 Warranty",
                rental: "기기 대여",
                interest: "선납 이자",
                other: "기타 비용",
              };
              return (
                <tr key={key}>
                  <th className="bg-gray-100 border p-3">{labels[key]}</th>
                  <td className="border p-3">{rowData.act}</td>
                  <td className="border p-3">{rowData.nom}</td>
                  <td className="border p-3 text-left px-4">{rowData.desc}</td>
                </tr>
              );
            })}
            <tr>
              <th className="bg-gray-100 border p-3">소계</th>
              <td className="border p-3 font-bold">
                {approval.costData.subtotal.act}
              </td>
              <td className="border p-3 font-bold">
                {approval.costData.subtotal.nom}
              </td>
              <td className="border p-3 text-left bg-blue-50">
                <p className="font-bold text-xs text-blue-800 mb-1">
                  [선택된 증빙서류]
                </p>
                <div className="flex flex-wrap gap-2">
                  {approval.costData.docTypes &&
                  approval.costData.docTypes.length > 0 ? (
                    approval.costData.docTypes.map((doc, i) => (
                      <span
                        key={i}
                        className="bg-white border border-blue-200 px-2 py-0.5 rounded text-xs text-blue-700 shadow-sm"
                      >
                        ✔ {doc}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 text-xs">선택 없음</span>
                  )}
                </div>
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-3">합계</th>
              <td className="border p-3 font-bold bg-blue-50" colSpan={2}>
                {approval.costData.total.val}
              </td>
              <td className="border p-3 text-left px-4">
                {approval.costData.total.desc}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* 첨부파일 영역 */}
      {approval.attachments && approval.attachments.length > 0 && (
        <div className="mt-6 border p-4 rounded-lg bg-gray-50">
          <h3 className="font-bold text-gray-700 mb-3 text-sm">📎 첨부파일</h3>
          <ul className="space-y-2">
            {approval.attachments.map((file, idx) => (
              <li
                key={idx}
                className="flex items-center gap-2 text-sm bg-white p-2 rounded border hover:bg-gray-50 transition-colors"
              >
                <span className="text-gray-400">📄</span>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium"
                >
                  {file.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-8 border rounded-xl bg-white shadow-sm w-5xl mx-auto mt-6 mb-20">
      {/* 1. 헤더 */}
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">{pageTitle}</h2>
        <div className="flex gap-2">
          <Link
            href={listPath}
            className="px-3 py-1.5 border rounded hover:bg-gray-100 text-sm flex items-center"
          >
            목록으로
          </Link>
          {userName === approval.userName && (
            <Link
              href={editPath}
              className="px-3 py-1.5 bg-[#519d9e] text-white rounded hover:bg-[#407f80] text-sm flex items-center"
            >
              수정
            </Link>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          {approval.title}
        </h3>
      </div>

      {/* 2. 상세 정보 렌더링 (타입 분기) */}
      {approvalType === "vehicle" ? (
        // 🚗 차량 신청서 뷰
        <>
          <table className="w-full border-collapse border border-gray-300 mb-8 text-sm">
            <tbody>
              <tr>
                <th className="bg-gray-100 border p-3 w-32">신청자</th>
                <td className="border p-3">{approval.userName}</td>
                <th className="bg-gray-100 border p-3 w-32">소속</th>
                <td className="border p-3">{approval.department}</td>
              </tr>
              <tr>
                <th className="bg-gray-100 border p-3 w-32">연락처</th>
                <td className="border p-3">{approval.contact || "-"}</td>
                <th className="bg-gray-100 border p-3 w-32">구분</th>
                <td className="border p-3">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={approval.isExternalWork}
                        readOnly
                        className="accent-[#519d9e]"
                      />{" "}
                      외근
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={approval.isVehicleUse}
                        readOnly
                        className="accent-[#519d9e]"
                      />{" "}
                      법인차량
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={approval.isPersonalVehicle}
                        readOnly
                        className="accent-[#519d9e]"
                      />{" "}
                      개인차량
                    </label>
                  </div>
                </td>
              </tr>
              <tr>
                <th className="bg-gray-100 border p-3">이용차량</th>
                <td className="border p-3" colSpan={3}>
                  {approval.vehicleModel || "-"}
                </td>
              </tr>
              <tr>
                <th className="bg-gray-100 border p-3">시행일자</th>
                <td className="border p-3">{approval.implementDate || "-"}</td>
                <th className="bg-gray-100 border p-3">외근/차량 사용일시</th>
                <td className="border p-3">{approval.usagePeriod || "-"}</td>
              </tr>
              <tr>
                <th className="bg-gray-100 border p-3">사용목적</th>
                <td className="border p-3" colSpan={3}>
                  {approval.purpose || approval.title}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mb-4">
            <h3 className="text-lg font-bold mb-2 border-l-4 border-[#519d9e] pl-2">
              상세 내용
            </h3>
            <div
              className="prose-editor min-h-[150px] p-4 bg-gray-50 rounded-lg border"
              dangerouslySetInnerHTML={{ __html: approval.content }}
            />
          </div>

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
                사고 발생 시 법인(070-8255-6004)에 보고 후 이용자가 처리비용
                부담
              </li>
              <li>
                도로교통법 등의 위반으로 인한 과태료 및 기타 법적인 책임은
                이용자임을 유의
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
              신청인: {approval.userName}
            </p>
          </div>
        </>
      ) : (
        // 🛒 구매 품의서 뷰
        renderPurchaseView()
      )}

      {/* 3. 결재 처리 (권한 있을 때만) */}
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
