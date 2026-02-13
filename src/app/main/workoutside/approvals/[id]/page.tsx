"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useState } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { useRef } from "react";

// ----------------------------------------------------------------
// [1] 타입 정의 (Strict Typing)
// ----------------------------------------------------------------
interface ExpenseItem {
  date: string;
  detail: string;
}

interface TransportCosts {
  bus: number;
  subway: number;
  taxi: number;
  other: number;
}

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

// ✅ [추가] 결재 이력 타입 정의
interface ApprovalHistoryEntry {
  approver: string;
  status: string;
  comment?: string;
  approvedAt: { seconds: number; nanoseconds: number } | string | number; // Firebase Timestamp or others
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

  // ✅ [추가 2] 통합 외근/출장용 필드 추가
  workType?: "outside" | "trip" | "outside_report" | "trip_report";
  docCategory?: "application" | "report"; // 신청서인지 보고서인지 구분
  transportType?: "company_car" | "personal_car" | "public" | "other";

  // 상세 정보
  customerDept?: string;
  customerEmail?: string;
  customerContact?: string; // 고객 담당자 이름

  // 기간
  usageDate?: string; // 외근 일시
  tripPeriod?: string; // 출장 기간

  // 출장 전용
  tripDestination?: string;
  tripCompanions?: string;
  tripExpenses?: ExpenseItem[];

  // 비용/차량
  transportCosts?: TransportCosts;

  // 결과보고서 (신청서에 나중에 추가된 결과 내용)
  resultReport?: string;

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

  // ✅ [추가] 결재 이력 필드 추가
  approvalHistory?: ApprovalHistoryEntry[];
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

  // ✅ [수정] 부서별 라인 대응 로직 + approverName 전송
  const approveMutation = useMutation({
    mutationFn: async ({ status }: { status: "approve" | "reject" }) => {
      if (!approval) throw new Error("Document not found");

      const myName = userName || "";
      const isFirst = approval.approvers?.first?.includes(myName);
      const isSecond = approval.approvers?.second?.includes(myName);
      const isThird = approval.approvers?.third?.includes(myName);

      // 다음 결재자가 진짜 존재하는지 체크 (빈 배열 확인)
      const hasSecondApprover =
        approval.approvers?.second && approval.approvers.second.length > 0;
      const hasThirdApprover =
        approval.approvers?.third && approval.approvers.third.length > 0;

      let nextStatus = "반려";

      if (status === "approve") {
        // [1차 결재자]
        if (isFirst && approval.status === "1차 결재 대기") {
          if (hasSecondApprover) {
            nextStatus = "2차 결재 대기";
          } else {
            nextStatus = "최종 승인 완료"; // 2차 없으면 바로 끝
          }
        }
        // [2차 결재자]
        else if (isSecond && approval.status === "2차 결재 대기") {
          if (hasThirdApprover) {
            nextStatus = "3차 결재 대기";
          } else {
            nextStatus = "최종 승인 완료"; // 3차 없으면 바로 끝
          }
        }
        // [3차 결재자]
        else if (isThird && approval.status === "3차 결재 대기") {
          nextStatus = "최종 승인 완료";
        } else {
          return; // 권한 없음
        }
      }

      // API 호출
      const res = await fetch("/api/approvals/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id,
          userName: approval.userName,
          approvalType: approval.approvalType,
          status: nextStatus,
          approverName: userName, // ✅ 결재자 실명 전송
          comment: comment,
        }),
      });

      if (!res.ok) throw new Error("처리 실패");
      return res.json();
    },
    onSuccess: async (_, { status }) => {
      // ✅ async 추가
      alert(status === "approve" ? "승인되었습니다." : "반려되었습니다.");

      // ✅ [핵심 추가 1] 전체 결재 목록 데이터를 최신화합니다.
      // 결재 대기함, 완료함 등의 리스트가 즉시 업데이트됩니다.
      await queryClient.invalidateQueries({ queryKey: ["approvals"] });

      // ✅ [핵심 추가 2] 현재 보고 있는 이 문서의 상세 데이터도 무효화합니다.
      // 이렇게 해야 상세 페이지 내의 결재 이력이나 상태 배지가 즉시 바뀝니다.
      await queryClient.invalidateQueries({ queryKey: ["approvalDetail", id] });

      // ✅ [추천] 대기함 목록으로 이동 (현재 로직 유지)
      router.push("/main/my-approval/pending");
    },
    onError: (err) => {
      console.error(err);
      alert("오류가 발생했습니다.");
    },
  });

  // ✅ [PDF] PDF 변환을 위한 Ref 생성
  const pdfRef = useRef<HTMLDivElement>(null);

  // ✅ [PDF] 다운로드 핸들러
  const handleDownloadPdf = async () => {
    const element = pdfRef.current;
    if (!element) return;

    try {
      // 🚨 필터 함수: 'exclude-from-pdf' 클래스가 있는 태그는 PDF에서 제외함
      const filter = (node: HTMLElement) => {
        if (node.classList?.contains("exclude-from-pdf")) return false;
        return true;
      };

      // 1. 이미지 변환
      const imgData = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "white",
        filter: filter,
        style: {
          borderRadius: "0",
          boxShadow: "none",
          border: "none",
        },
      });

      // 2. PDF 생성 (A4)
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
      const imgProps = pdf.getImageProperties(imgData);

      // 210mm 꽉 채우지 말고 좌우 5mm 정도 여유를 줍니다.
      const margin = 5;
      const usableWidth = pdfWidth - margin * 2;
      let imgWidth = usableWidth;
      let imgHeight = (imgProps.height * usableWidth) / imgProps.width;

      // 높이가 A4 초과 시 축소 로직 유지
      if (imgHeight > pdfHeight) {
        // 상하 여유 20mm
        imgHeight = pdfHeight;
        imgWidth = (imgProps.width * imgHeight) / imgProps.height;
      }

      // 3. 중앙 정렬 위치 계산
      const x = (pdfWidth - imgWidth) / 2;
      const y = 10; // 상단에서 10mm 띄움

      // 5. 페이지 추가 없이 한 번에 그리기
      pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);

      // 6. 저장
      const fileName = `${approvalType === "sales" ? "판매" : "구매"}품의서_${
        approval?.customerName || approval?.userName
      }.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error("PDF 저장 실패:", err);
      alert("PDF 변환 중 오류가 발생했습니다.");
    }
  };

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

  if (approvalType === "integrated_outside") {
    // 🆕 신규 통합 문서 (외근/출장/보고서)
    listPath = "/main/workoutside/approvals/vehicle";
    editPath = `/main/workoutside/approvals/vehicle/edit/${id}`;

    switch (approval.workType) {
      case "outside":
        pageTitle = "외근 신청서";
        break;
      case "trip":
        pageTitle = "출장 신청서";
        break;
      case "outside_report":
        pageTitle = "외근 결과 보고서";
        break;
      case "trip_report":
        pageTitle = "출장 결과 보고서";
        break;
      default:
        pageTitle = "외근/출장 문서";
    }
  } else {
    // 📦 기존 문서 (차량, 판매, 구매)
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
        <div className="mt-6 border p-4 rounded-lg bg-gray-50 exclude-from-pdf">
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

  // ----------------------------------------------------------------
  // ✅ [추가 3] 통합 외근/출장 렌더링 헬퍼 함수
  // ----------------------------------------------------------------
  const renderIntegratedView = () => {
    // 보고서 여부 및 출장 여부 확인
    const isReport = approval.workType?.includes("report");
    const isTrip = approval.workType?.includes("trip");

    return (
      <>
        <table className="w-full border-collapse border border-gray-300 mb-8 text-sm">
          <tbody>
            {/* 1. 구분 및 이동방법 */}
            <tr>
              <th className="bg-gray-100 border p-3 w-32">구분</th>
              <td className="border p-3 font-bold text-[#519d9e]">
                {approval.workType === "outside" && "[외근]"}
                {approval.workType === "trip" && "[출장]"}
                {approval.workType === "outside_report" && (
                  <span className="text-purple-600">[외근보고]</span>
                )}
                {approval.workType === "trip_report" && (
                  <span className="text-purple-600">[출장보고]</span>
                )}
              </td>
              <th className="bg-gray-100 border p-3 w-32">이동방법</th>
              <td className="border p-3">
                {approval.transportType === "company_car" && "법인차량"}
                {approval.transportType === "personal_car" && "자차"}
                {approval.transportType === "public" && "대중교통"}
                {approval.transportType === "other" && "기타"}
              </td>
            </tr>

            {/* 2. 일시/기간 */}
            <tr>
              <th className="bg-gray-100 border p-3">
                {isTrip ? "출장 기간" : "방문 일시"}
              </th>
              <td className="border p-3" colSpan={3}>
                {isTrip ? approval.tripPeriod : approval.usageDate}
              </td>
            </tr>

            {/* 3. 고객 정보 (통합) */}
            <tr>
              <th className="bg-gray-100 border p-3" rowSpan={2}>
                고객 정보
              </th>
              <td className="border p-3" colSpan={3}>
                <span className="mr-4">
                  <b>고객사:</b> {approval.customerName}
                </span>
                <span>
                  <b>부서:</b> {approval.customerDept || "-"}
                </span>
              </td>
            </tr>
            <tr>
              <td className="border p-3" colSpan={3}>
                <span className="mr-4">
                  <b>담당자:</b> {approval.customerContact}
                </span>
                <span>
                  <b>이메일:</b> {approval.customerEmail || "-"}
                </span>
              </td>
            </tr>

            {/* 4. 출장 상세 (출장일 경우만) */}
            {isTrip && (
              <tr>
                <th className="bg-gray-100 border p-3">출장 상세</th>
                <td className="border p-3" colSpan={3}>
                  <span className="mr-4">
                    <b>출장지:</b> {approval.tripDestination}
                  </span>
                  <span>
                    <b>동행자:</b> {approval.tripCompanions || "-"}
                  </span>
                </td>
              </tr>
            )}

            {/* 5. 차량 또는 교통비 정보 */}
            {(approval.transportType === "company_car" ||
              approval.transportType === "personal_car") && (
              <tr>
                <th className="bg-gray-100 border p-3">차량 정보</th>
                <td className="border p-3" colSpan={3}>
                  {approval.vehicleModel || "-"}
                </td>
              </tr>
            )}
            {approval.transportType === "public" && approval.transportCosts && (
              <tr>
                <th className="bg-gray-100 border p-3">교통비(예상/실비)</th>
                <td className="border p-3" colSpan={3}>
                  버스: {approval.transportCosts.bus.toLocaleString()}원 /
                  지하철: {approval.transportCosts.subway.toLocaleString()}원 /
                  택시: {approval.transportCosts.taxi.toLocaleString()}원 /
                  기타: {approval.transportCosts.other.toLocaleString()}원
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 6. 출장 경비 목록 (출장일 경우만) */}
        {isTrip &&
          approval.tripExpenses &&
          approval.tripExpenses.length > 0 && (
            <div className="mb-8">
              <h4 className="font-bold text-gray-700 mb-2 text-sm">
                💰 경비 내역
              </h4>
              <table className="w-full border-collapse border border-gray-300 text-sm text-center">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border p-2 w-32">일자</th>
                    <th className="border p-2">내역 및 금액</th>
                  </tr>
                </thead>
                <tbody>
                  {approval.tripExpenses.map((exp, idx) => (
                    <tr key={idx}>
                      <td className="border p-2">{exp.date}</td>
                      <td className="border p-2 text-left px-4">
                        {exp.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {/* 7. 내용 (신청 내용 or 결과 내용) */}
        <div className="mb-8">
          <h3
            className={`text-lg font-bold mb-2 border-l-4 pl-2 ${
              isReport
                ? "border-purple-600 text-purple-800"
                : "border-[#519d9e] text-[#519d9e]"
            }`}
          >
            {isReport ? "업무 협의 내용" : "업무 협의 내용"}
          </h3>
          <div
            className="prose-editor min-h-[100px] p-4 bg-gray-50 rounded-lg border"
            dangerouslySetInnerHTML={{ __html: approval.content }}
          />
        </div>
      </>
    );
  };

  // ✅ [추가] 결재 라인 볼 수 있는 권한 확인
  const canViewApprovalLine = () => {
    if (!approval || !userName) return false;
    // 1. 작성자 본인
    if (approval.userName === userName) return true;

    // 2. 결재선에 포함된 사람 (1,2,3차)
    const first = approval.approvers?.first || [];
    const second = approval.approvers?.second || [];
    const third = approval.approvers?.third || [];
    const shared = approval.approvers?.shared || [];

    const allRelatedUsers = [...first, ...second, ...third, ...shared];
    return allRelatedUsers.includes(userName);
  };

  // ✅ [수정] 결재 라인 박스 렌더링 함수 (Type Error 해결)
  const renderApprovalLineBox = () => {
    if (!canViewApprovalLine()) return null;

    const drafter = approval.userName;
    const firstApprover = approval.approvers?.first?.[0];
    const secondApprover = approval.approvers?.second?.[0];
    const thirdApprover = approval.approvers?.third?.[0];

    // 상태 및 날짜 찾는 헬퍼 함수
    const getStatusAndDate = (
      name: string | undefined
    ): { status: string; date: string; color: string } => {
      if (!name) return { status: "미결", date: "", color: "text-gray-300" };

      // 이력에서 찾기
      const historyItem = approval.approvalHistory?.find(
        (h) => h.approver === name
      );

      if (historyItem) {
        let dateStr = "";
        const at = historyItem.approvedAt;

        try {
          // 2. [ESLint 해결] 구체적인 타입 가드 사용 (any 제거)
          if (typeof at === "object" && "seconds" in at) {
            // Standard Firestore Timestamp
            dateStr = new Date(
              (at as { seconds: number }).seconds * 1000
            ).toLocaleDateString(undefined, {
              month: "2-digit",
              day: "2-digit",
            });
          } else if (typeof at === "object" && "_seconds" in at) {
            // Serialized Timestamp
            dateStr = new Date(
              (at as { _seconds: number })._seconds * 1000
            ).toLocaleDateString(undefined, {
              month: "2-digit",
              day: "2-digit",
            });
          } else {
            // String, Number, Date
            dateStr = new Date(at as string | number | Date).toLocaleDateString(
              undefined,
              { month: "2-digit", day: "2-digit" }
            );
          }
        } catch {
          dateStr = "완료";
        }

        // 반려 체크
        if (historyItem.status.includes("반려")) {
          return { status: "반려", date: dateStr, color: "text-red-600" };
        }
        return { status: "승인", date: dateStr, color: "text-blue-600" };
      }

      // 3. [TS 해결] 모든 리턴 객체에 'color' 속성 추가
      // 이력에 없으면 현재 문서 상태로 추론
      if (approval.status.includes("반려")) {
        return { status: "취소", date: "-", color: "text-gray-400" }; // 이미 반려된 문서의 미결재자 처리
      }

      // 대기 상태 체크
      if (name === firstApprover && approval.status === "1차 결재 대기")
        return { status: "대기", date: "", color: "text-gray-500" };
      if (name === secondApprover && approval.status === "2차 결재 대기")
        return { status: "대기", date: "", color: "text-gray-500" };
      if (name === thirdApprover && approval.status === "3차 결재 대기")
        return { status: "대기", date: "", color: "text-gray-500" };

      return { status: "미결", date: "", color: "text-gray-300" };
    };

    // 박스 UI 생성 헬퍼
    const ApproverBox = ({
      role,
      name,
      isDrafter = false,
    }: {
      role: string;
      name?: string;
      isDrafter?: boolean;
    }) => {
      if (!name && !isDrafter) return null;

      let info = { status: "미결", date: "", color: "text-gray-300" };

      if (isDrafter) {
        const date = new Date(approval.createdAt).toLocaleDateString(
          undefined,
          { month: "2-digit", day: "2-digit" }
        );
        info = { status: "신청", date: date, color: "text-gray-800" };
      } else {
        info = getStatusAndDate(name);
      }

      return (
        <div className="flex flex-col border border-gray-400 w-[70px]">
          <div className="bg-gray-100 text-center text-[10px] py-1 border-b border-gray-400 font-medium text-gray-600">
            {role}
          </div>
          <div className="h-[50px] flex flex-col justify-center items-center text-[11px] bg-white relative">
            <span className="text-[10px] text-gray-800 mb-0.5">
              {isDrafter ? name : name?.split(" ")[0]}
            </span>

            {info.status === "승인" || info.status === "신청" ? (
              <div
                className={`border-2 rounded-full w-10 h-10 flex items-center justify-center absolute opacity-80 ${
                  isDrafter
                    ? "border-gray-400 text-gray-600"
                    : "border-red-500 text-red-500"
                }`}
              >
                <span className="text-[10px] font-bold">{info.status}</span>
              </div>
            ) : (
              <span className={`font-bold ${info.color}`}>{info.status}</span>
            )}
          </div>
          <div className="bg-white text-center text-[9px] py-0.5 border-t border-gray-200 text-gray-500 h-[18px]">
            {info.date}
          </div>
        </div>
      );
    };

    return (
      <div className="flex select-none">
        <div className="flex items-center justify-center bg-gray-200 border border-gray-400 w-6 text-center text-xs font-bold text-gray-600 px-1">
          결<br />재
        </div>
        <ApproverBox role="신청" name={drafter} isDrafter={true} />
        <ApproverBox role="1차" name={firstApprover} />
        <ApproverBox role="2차" name={secondApprover} />
        <ApproverBox role="3차" name={thirdApprover} />
      </div>
    );
  };

  return (
    <div className="p-8 border rounded-xl bg-white shadow-sm w-5xl mx-auto mt-6 mb-20">
      {/* 실제 PDF로 캡처할 내용물 (여기서부터 ref 시작) */}
      {/* p-2 정도의 여백을 주어 테이블 테두리가 짤리지 않게 보호합니다. */}
      <div ref={pdfRef} className="bg-white p-2">
        {/* 1. 헤더 */}
        <div className="flex justify-between items-center mb-6 border-b pb-4 exclude-from-pdf">
          <h2 className="text-2xl font-bold text-gray-800">{pageTitle}</h2>
          <div className="flex gap-2 exclude-from-pdf">
            <Link
              href={listPath}
              prefetch={false}
              className="px-3 py-1.5 border rounded hover:bg-gray-100 text-sm flex items-center "
            >
              목록으로
            </Link>
            {userName === approval.userName && (
              <Link
                href={editPath}
                prefetch={false}
                className="px-3 py-1.5 bg-[#519d9e] text-white rounded hover:bg-[#407f80] text-sm flex items-center"
              >
                수정
              </Link>
            )}
          </div>
        </div>

        {/* 타이틀 및 결재선 영역 */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start gap-4">
          {/* 왼쪽: 제목 및 정보 */}
          <div className="flex-1">
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <h3 className="text-xl font-semibold text-gray-700 flex items-center">
                {/* 통합 외근/출장 문서일 경우에만 배지 표시 */}
                {approval.approvalType === "integrated_outside" && (
                  <span
                    className={`mr-2 font-bold whitespace-nowrap ${
                      // 보고서 타입(_report)이면 보라색, 아니면 청록색
                      approval.workType?.includes("report")
                        ? "text-purple-600"
                        : "text-[#519d9e]"
                    }`}
                  >
                    {/* 4가지 workType에 따라 정확한 말머리 표시 */}
                    {approval.workType === "outside" && "[외근]"}
                    {approval.workType === "trip" && "[출장]"}
                    {approval.workType === "outside_report" && "[외근보고]"}
                    {approval.workType === "trip_report" && "[출장보고]"}
                  </span>
                )}
                {approval.title}
              </h3>
            </div>

            <p className="text-sm text-gray-500">
              {/* 날짜 표시 로직 */}
              {approval.approvalType === "integrated_outside" &&
              approval.implementDate
                ? `날짜: ${new Date(
                    approval.implementDate
                  ).toLocaleDateString()}`
                : `작성일: ${new Date(
                    approval.createdAt
                  ).toLocaleDateString()}`}
              <span className="mx-2">|</span>
              작성자:{" "}
              <span className="font-medium text-gray-700">
                {approval.userName}
              </span>
            </p>
          </div>

          {/* ✅ [오른쪽 수정] PDF 버튼과 결재 라인을 세로로 배치 */}
          <div className="flex-shrink-0 flex flex-col items-end gap-3">
            {/* 🖨️ PDF 버튼 (구매/판매 품의서일 때만 표시) */}
            {(approvalType === "purchase" || approvalType === "sales") && (
              <button
                onClick={handleDownloadPdf}
                className="exclude-from-pdf flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                <span>📥</span> PDF 저장
              </button>
            )}

            {/* 결재 라인 박스 */}
            {renderApprovalLineBox()}
          </div>
        </div>

        {/* 2. 상세 정보 렌더링 (타입 분기) */}
        {approval.approvalType === "integrated_outside" ? (
          renderIntegratedView()
        ) : approvalType === "vehicle" ? (
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
                  <td className="border p-3">
                    {approval.implementDate || "-"}
                  </td>
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
                <p>
                  ※ 위 작성자는 법인차량 이용수칙을 확인하고 동의하였습니다.
                </p>
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
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* ✅ [추가] 결재 진행 이력 및 코멘트 표시 영역 */}
      {/* ---------------------------------------------------------------- */}
      {approval.approvalHistory && approval.approvalHistory.length > 0 && (
        <div className="mt-12 border-t border-gray-200 exclude-from-pdf">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            📋 결재 진행 이력
          </h3>
          <div className="space-y-4">
            {approval.approvalHistory.map((history, idx) => {
              let dateStr = "";

              // 1. [ESLint 해결] any 대신 구체적인 타입을 사용하여 타입 단언
              const at = history.approvedAt as
                | { seconds?: number; _seconds?: number }
                | string
                | number
                | Date;

              try {
                if (!at) {
                  dateStr = "-";
                }
                // 2. { seconds: ... } 형태 (Standard Firestore)
                else if (
                  typeof at === "object" &&
                  "seconds" in at &&
                  typeof at.seconds === "number"
                ) {
                  dateStr = new Date(at.seconds * 1000).toLocaleString();
                }
                // 3. { _seconds: ... } 형태 (Admin SDK 직렬화 이슈 대응)
                else if (
                  typeof at === "object" &&
                  "_seconds" in at &&
                  typeof at._seconds === "number"
                ) {
                  dateStr = new Date(at._seconds * 1000).toLocaleString();
                }
                // 4. 문자열, 숫자, Date 객체 처리
                else {
                  const d = new Date(at as string | number | Date);
                  if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleString();
                  } else {
                    dateStr = "날짜 오류";
                  }
                }
              } catch {
                // 5. [ESLint 해결] 사용하지 않는 (e) 제거 -> catch 만 사용
                dateStr = "-";
              }

              // 상태에 따른 배지 색상
              const isReject = history.status.includes("반려");
              const badgeClass = isReject
                ? "bg-red-100 text-red-700 border-red-200"
                : "bg-blue-100 text-blue-700 border-blue-200";

              return (
                <div
                  key={idx}
                  className="bg-gray-50 border rounded-lg p-4 shadow-sm exclude-from-pdf"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">
                        {history.approver}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${badgeClass}`}
                      >
                        {history.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{dateStr}</span>
                  </div>

                  {/* 코멘트가 있을 때만 표시 */}
                  {history.comment ? (
                    <div className="mt-2 bg-white  rounded text-sm text-gray-700 whitespace-pre-wrap">
                      <span className="font-bold text-gray-500 mr-2">
                        💬 의견:
                      </span>
                      {history.comment}
                    </div>
                  ) : (
                    <div className="mt-2 bg-white  rounded text-sm text-gray-700 whitespace-pre-wrap">
                      <span className="font-bold text-gray-500 mr-2">
                        💬 의견: 코멘트가 없습니다.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. 결재 처리 (권한 있을 때만) */}
      {canApprove && (
        <div className="mt-12 pt-8 border-t border-gray-200 exclude-from-pdf">
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
