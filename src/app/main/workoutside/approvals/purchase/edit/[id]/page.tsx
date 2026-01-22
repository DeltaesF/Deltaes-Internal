"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useMutation, useQuery } from "@tanstack/react-query";

// --------------------------------------------------------
// [1] 타입 정의 (Write 페이지와 동일)
// --------------------------------------------------------
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

interface PurchaseFormData {
  serialNumber: string;
  writeDate: string;
  customerName: string;
  product: string;
  endUser: string;
  customerInfo: string;
  contractDate: string;
  introductionType: string;
  introductionMemo: string;
  deliveryDate: string;
  paymentPending: string;
  paymentPendingAmount: string;
  billingDate: string;
  cashCollection: string;
  cashCollectionDays: string;
  collectionDate: string;
  noteCollection: string;
  noteCollectionDays: string;
  noteMaturityDate: string;
  specialNotes: string;
  priceData: PriceData;
  costData: CostData;
  attachments: { name: string; url: string }[];
}

// API Response 타입
interface ApprovalDetailResponse extends Partial<PurchaseFormData> {
  id: string;
  approvalType: string;
  title: string;
}

const fetchDetail = async (id: string): Promise<ApprovalDetailResponse> => {
  const res = await fetch("/api/approvals/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Load failed");
  return res.json();
};

export default function PurchaseApprovalEdit() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { userName } = useSelector((state: RootState) => state.auth);

  // 파일 선택 상태 (새로 추가할 파일)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["approvalDetail", id],
    queryFn: () => fetchDetail(id),
    enabled: !!id,
  });

  const [formData, setFormData] = useState<PurchaseFormData | null>(null);

  // --------------------------------------------------------
  // [2] 데이터 로드 및 초기화
  // --------------------------------------------------------
  useEffect(() => {
    if (detail) {
      setFormData({
        serialNumber: detail.serialNumber || "",
        writeDate: detail.writeDate || "",
        customerName: detail.customerName || "",
        product: detail.product || "",
        endUser: detail.endUser || "",
        customerInfo: detail.customerInfo || "",
        contractDate: detail.contractDate || "",
        introductionType: detail.introductionType || "Purchase",
        introductionMemo: detail.introductionMemo || "",
        deliveryDate: detail.deliveryDate || "",
        paymentPending: detail.paymentPending || "무",
        paymentPendingAmount: detail.paymentPendingAmount || "",
        billingDate: detail.billingDate || "",
        cashCollection: detail.cashCollection || "납품",
        cashCollectionDays: detail.cashCollectionDays || "",
        collectionDate: detail.collectionDate || "",
        noteCollection: detail.noteCollection || "납품",
        noteCollectionDays: detail.noteCollectionDays || "",
        noteMaturityDate: detail.noteMaturityDate || "",
        specialNotes: detail.specialNotes || "",
        priceData: detail.priceData || {
          list: { orig: "", mod: "" },
          contract: { orig: "", mod: "" },
          dc: { orig: "", mod: "" },
          salesNet: { orig: "", mod: "" },
          profit: { orig: "", mod: "" },
          warranty: { orig: "", mod: "" },
          remarks: "",
        },
        costData: detail.costData || {
          transport: { act: "", nom: "", desc: "" },
          warranty: { act: "", nom: "", desc: "" },
          travel: { act: "", nom: "", desc: "" },
          overseas: { act: "", nom: "", desc: "" },
          personnel: { act: "", nom: "", desc: "" },
          material: { act: "", nom: "", desc: "" },
          extraWarranty: { act: "", nom: "", desc: "" },
          rental: { act: "", nom: "", desc: "" },
          interest: { act: "", nom: "", desc: "" },
          other: { act: "", nom: "", desc: "" },
          subtotal: { act: "", nom: "" },
          docTypes: [],
          total: { val: "", desc: "" },
        },
        attachments: detail.attachments || [],
      });
    }
  }, [detail]);

  // --------------------------------------------------------
  // [3] 핸들러
  // --------------------------------------------------------
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    if (!formData) return;
    const { name, value } = e.target;
    setFormData((prev) => (prev ? { ...prev, [name]: value } : null));
  };

  const handlePriceChange = (
    key: keyof PriceData,
    field: keyof PriceDetails | "remarks",
    value: string
  ) => {
    if (!formData) return;
    setFormData((prev) => {
      if (!prev) return null;
      if (key === "remarks") {
        return { ...prev, priceData: { ...prev.priceData, remarks: value } };
      }
      return {
        ...prev,
        priceData: {
          ...prev.priceData,
          [key]: { ...(prev.priceData[key] as PriceDetails), [field]: value },
        },
      };
    });
  };

  const handleCostChange = (
    key: keyof CostData,
    field: string,
    value: string
  ) => {
    if (!formData) return;
    setFormData((prev) => {
      if (!prev) return null;
      // docTypes는 별도 핸들러에서 처리하므로 여기서는 무시하거나 에러 방지
      if (key === "docTypes") return prev;

      const currentItem = prev.costData[key];
      if (
        typeof currentItem === "object" &&
        currentItem !== null &&
        !Array.isArray(currentItem)
      ) {
        return {
          ...prev,
          costData: {
            ...prev.costData,
            [key]: { ...currentItem, [field]: value },
          },
        };
      }
      return prev;
    });
  };

  const handleDocTypeToggle = (type: string) => {
    if (!formData) return;
    setFormData((prev) => {
      if (!prev) return null;
      const currentTypes = prev.costData.docTypes || [];
      const exists = currentTypes.includes(type);
      const newTypes = exists
        ? currentTypes.filter((t) => t !== type)
        : [...currentTypes, type];
      return { ...prev, costData: { ...prev.costData, docTypes: newTypes } };
    });
  };

  // 기존 파일 삭제
  const removeExistingFile = (index: number) => {
    if (!formData) return;
    const newAttachments = formData.attachments.filter((_, i) => i !== index);
    setFormData({ ...formData, attachments: newAttachments });
  };

  // 새 파일 추가
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  // 새 파일 목록에서 삭제
  const removeNewFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // --------------------------------------------------------
  // [4] API 전송 (Update)
  // --------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!formData) return;

      // 1. 새 파일 업로드
      let newUploadedAttachments: { name: string; url: string }[] = [];
      if (selectedFiles.length > 0) {
        const fileFormData = new FormData();
        selectedFiles.forEach((file) => fileFormData.append("files", file));
        const uploadRes = await fetch("/api/approvals/upload", {
          method: "POST",
          body: fileFormData,
        });
        if (!uploadRes.ok) throw new Error("파일 업로드 실패");
        const uploadData = await uploadRes.json();
        newUploadedAttachments = uploadData.files;
      }

      // 2. 최종 첨부파일 리스트 (기존 + 신규)
      const finalAttachments = [
        ...formData.attachments,
        ...newUploadedAttachments,
      ];

      // 3. 업데이트 요청
      const res = await fetch("/api/approvals/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          attachments: finalAttachments,
          id,
          userName,
          approvalType: "purchase",
          title: `[구매품의] ${formData.customerName}_${formData.product}`,
        }),
      });
      if (!res.ok) throw new Error("수정 실패");
      return res.json();
    },
    onSuccess: () => {
      alert("수정되었습니다.");
      router.push(`/main/workoutside/approvals/${id}`);
    },
    onError: (err) => alert(err.message),
  });

  if (isLoading || !formData)
    return <div className="p-10 text-center">로딩 중...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto bg-white min-h-screen pb-20 border rounded-xl shadow-sm mt-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        📝 구매 품의서 수정
      </h1>

      {/* 헤더 */}
      <div className="grid grid-cols-2 gap-4 mb-6 border p-4 rounded-lg bg-gray-50 text-sm">
        <div className="flex items-center">
          <span className="w-24 font-bold text-gray-600">일련번호</span>
          <input
            name="serialNumber"
            value={formData.serialNumber}
            onChange={handleChange}
            className="border p-1 rounded w-full max-w-xs"
          />
        </div>
        <div className="flex items-center">
          <span className="w-24 font-bold text-gray-600">작성일자</span>
          <input
            type="date"
            name="writeDate"
            value={formData.writeDate}
            onChange={handleChange}
            className="border p-1 rounded"
          />
        </div>
        <div className="flex items-center">
          <span className="w-24 font-bold text-gray-600">영업담당자</span>
          <span className="font-medium">{userName}</span>
        </div>
      </div>

      <div className="space-y-8 text-sm">
        {/* Table 1: 기본 정보 */}
        <table className="w-full border-collapse border border-gray-300">
          <tbody>
            <tr>
              <th className="bg-gray-100 border p-2 w-32">고객명</th>
              <td className="border p-2">
                <input
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleChange}
                  className="w-full outline-none"
                />
              </td>
              <th className="bg-gray-100 border p-2 w-32">product</th>
              <td className="border p-2">
                <input
                  name="product"
                  value={formData.product}
                  onChange={handleChange}
                  className="w-full outline-none"
                />
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-2">End User</th>
              <td className="border p-2">
                <input
                  name="endUser"
                  value={formData.endUser}
                  onChange={handleChange}
                  className="w-full outline-none"
                />
              </td>
              <th className="bg-gray-100 border p-2">고객정보</th>
              <td className="border p-2">
                <input
                  name="customerInfo"
                  value={formData.customerInfo}
                  onChange={handleChange}
                  className="w-full outline-none"
                />
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-2">계약일</th>
              <td className="border p-2">
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="date"
                    name="contractDate"
                    value={formData.contractDate}
                    onChange={handleChange}
                    className="border p-1"
                  />
                </div>
                <div className="flex gap-2 text-xs">
                  {["Purchase", "Lease", "Support"].map((type) => (
                    <label key={type}>
                      <input
                        type="radio"
                        name="introductionType"
                        value={type}
                        checked={formData.introductionType === type}
                        onChange={handleChange}
                      />{" "}
                      {type}
                    </label>
                  ))}
                </div>
              </td>
              <td className="border p-2" rowSpan={3} colSpan={2}>
                <textarea
                  name="introductionMemo"
                  value={formData.introductionMemo}
                  onChange={handleChange}
                  className="w-full h-full min-h-[120px] resize-none outline-none p-2 bg-yellow-50"
                />
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-2">납품일</th>
              <td className="border p-2">
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="date"
                    name="deliveryDate"
                    value={formData.deliveryDate}
                    onChange={handleChange}
                    className="border p-1"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold">수금 미결:</span>
                  <label>
                    <input
                      type="radio"
                      name="paymentPending"
                      value="무"
                      checked={formData.paymentPending === "무"}
                      onChange={handleChange}
                    />{" "}
                    무
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="paymentPending"
                      value="유"
                      checked={formData.paymentPending === "유"}
                      onChange={handleChange}
                    />{" "}
                    유
                  </label>
                  <input
                    name="paymentPendingAmount"
                    value={formData.paymentPendingAmount}
                    onChange={handleChange}
                    className="border-b w-16 text-center"
                  />
                  원
                </div>
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-2">청구일</th>
              <td className="border p-2">
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="date"
                    name="billingDate"
                    value={formData.billingDate}
                    onChange={handleChange}
                    className="border p-1"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold">현금 수금:</span>
                  <label>
                    <input
                      type="radio"
                      name="cashCollection"
                      value="납품"
                      checked={formData.cashCollection === "납품"}
                      onChange={handleChange}
                    />{" "}
                    납품
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="cashCollection"
                      value="청구"
                      checked={formData.cashCollection === "청구"}
                      onChange={handleChange}
                    />{" "}
                    청구
                  </label>{" "}
                  후{" "}
                  <input
                    name="cashCollectionDays"
                    value={formData.cashCollectionDays}
                    onChange={handleChange}
                    className="border-b w-8 text-center"
                  />{" "}
                  일
                </div>
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-2">수금일</th>
              <td className="border p-2">
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="date"
                    name="collectionDate"
                    value={formData.collectionDate}
                    onChange={handleChange}
                    className="border p-1"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold">어음 수금:</span>
                  <label>
                    <input
                      type="radio"
                      name="noteCollection"
                      value="납품"
                      checked={formData.noteCollection === "납품"}
                      onChange={handleChange}
                    />{" "}
                    납품
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="noteCollection"
                      value="청구"
                      checked={formData.noteCollection === "청구"}
                      onChange={handleChange}
                    />{" "}
                    청구
                  </label>{" "}
                  후{" "}
                  <input
                    name="noteCollectionDays"
                    value={formData.noteCollectionDays}
                    onChange={handleChange}
                    className="border-b w-8 text-center"
                  />{" "}
                  일
                </div>
              </td>
              <th className="bg-gray-100 border p-2">어음만기일</th>
              <td className="border p-2">
                <input
                  type="date"
                  name="noteMaturityDate"
                  value={formData.noteMaturityDate}
                  onChange={handleChange}
                  className="border p-1 w-full"
                />
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-2" colSpan={4}>
                납품 ~ 수금관련 특기사항
              </th>
            </tr>
            <tr>
              <td className="border p-2" colSpan={4}>
                <textarea
                  name="specialNotes"
                  value={formData.specialNotes}
                  onChange={handleChange}
                  className="w-full p-2 outline-none h-20"
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Table 2: 금액 정보 */}
        <table className="w-full border-collapse border border-gray-300 text-center">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 w-32">구분</th>
              <th className="border p-2">원안</th>
              <th className="border p-2">수정</th>
              <th className="border p-2">비고 (통합)</th>
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
              const rowData = formData.priceData[key] as PriceDetails;
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
                  <th className="bg-gray-100 border p-2">{labels[key]}</th>
                  <td className="border p-1">
                    <input
                      value={rowData.orig}
                      onChange={(e) =>
                        handlePriceChange(key, "orig", e.target.value)
                      }
                      className="w-full text-center outline-none"
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      value={rowData.mod}
                      onChange={(e) =>
                        handlePriceChange(key, "mod", e.target.value)
                      }
                      className="w-full text-center outline-none bg-gray-50"
                    />
                  </td>
                  {idx === 0 && (
                    <td className="border p-2" rowSpan={6}>
                      <textarea
                        value={formData.priceData.remarks}
                        onChange={(e) =>
                          handlePriceChange(
                            "remarks",
                            "remarks",
                            e.target.value
                          )
                        }
                        className="w-full h-full min-h-[200px] resize-none outline-none bg-yellow-50 p-2"
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Table 3: 비용 정보 */}
        <table className="w-full border-collapse border border-gray-300 text-center">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 w-32">비용 항목</th>
              <th className="border p-2">실질 투입</th>
              <th className="border p-2">명목 투입</th>
              <th className="border p-2">적요 및 산출 근거</th>
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
              const rowData = formData.costData[key] as CostDetails;
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
                  <th className="bg-gray-100 border p-2">{labels[key]}</th>
                  <td className="border p-1">
                    <input
                      value={rowData.act}
                      onChange={(e) =>
                        handleCostChange(key, "act", e.target.value)
                      }
                      className="w-full text-center outline-none"
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      value={rowData.nom}
                      onChange={(e) =>
                        handleCostChange(key, "nom", e.target.value)
                      }
                      className="w-full text-center outline-none"
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      value={rowData.desc}
                      onChange={(e) =>
                        handleCostChange(key, "desc", e.target.value)
                      }
                      className="w-full text-left px-2 outline-none"
                    />
                  </td>
                </tr>
              );
            })}
            <tr>
              <th className="bg-gray-100 border p-2">소계</th>
              <td className="border p-1">
                <input
                  value={formData.costData.subtotal.act}
                  onChange={(e) =>
                    handleCostChange("subtotal", "act", e.target.value)
                  }
                  className="w-full text-center font-bold"
                />
              </td>
              <td className="border p-1">
                <input
                  value={formData.costData.subtotal.nom}
                  onChange={(e) =>
                    handleCostChange("subtotal", "nom", e.target.value)
                  }
                  className="w-full text-center font-bold"
                />
              </td>
              <td className="border p-2 text-left bg-blue-50">
                <p className="font-bold text-xs mb-2 text-blue-800">
                  [증빙서류 선택]
                </p>
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="font-bold mr-1">1.</span>
                    {["견적서", "물품명세", "발주서", "계약서"].map((doc) => (
                      <label
                        key={doc}
                        className="flex items-center gap-1 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.costData.docTypes.includes(doc)}
                          onChange={() => handleDocTypeToggle(doc)}
                        />{" "}
                        {doc}
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold mr-1">2.</span>
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.costData.docTypes.includes(
                          "운송협조전"
                        )}
                        onChange={() => handleDocTypeToggle("운송협조전")}
                      />{" "}
                      운송협조전
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold mr-1">3.</span>
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.costData.docTypes.includes(
                          "설치요청서"
                        )}
                        onChange={() => handleDocTypeToggle("설치요청서")}
                      />{" "}
                      설치요청서
                    </label>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border p-2">합계</th>
              <td className="border p-2 font-bold bg-blue-50" colSpan={2}>
                <input
                  value={formData.costData.total.val}
                  onChange={(e) =>
                    handleCostChange("total", "val", e.target.value)
                  }
                  className="w-full text-center bg-transparent outline-none"
                />
              </td>
              <td className="border p-1">
                <input
                  value={formData.costData.total.desc}
                  onChange={(e) =>
                    handleCostChange("total", "desc", e.target.value)
                  }
                  className="w-full px-2 outline-none"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 파일 첨부 (수정 모드) */}
      <div className="mt-6 border p-4 rounded-lg bg-gray-50">
        <h3 className="font-bold text-gray-700 mb-2">
          📎 파일 첨부 (다중 선택 가능)
        </h3>
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />

        {/* 기존 파일 목록 */}
        {formData.attachments.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-gray-500 mb-1">기존 파일:</p>
            <ul className="space-y-1">
              {formData.attachments.map((file, idx) => (
                <li
                  key={`exist-${idx}`}
                  className="flex items-center justify-between text-xs bg-white p-2 rounded border"
                >
                  <a
                    href={file.url}
                    target="_blank"
                    className="text-blue-600 hover:underline"
                  >
                    📎 {file.name}
                  </a>
                  <button
                    onClick={() => removeExistingFile(idx)}
                    className="text-red-500 hover:text-red-700 font-bold px-2"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 새 파일 목록 */}
        {selectedFiles.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-green-600 mb-1">
              새로 추가된 파일:
            </p>
            <ul className="space-y-1">
              {selectedFiles.map((file, idx) => (
                <li
                  key={`new-${idx}`}
                  className="flex items-center justify-between text-xs bg-white p-2 rounded border border-green-200"
                >
                  <span>
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                  <button
                    onClick={() => removeNewFile(idx)}
                    className="text-red-500 hover:text-red-700 font-bold px-2"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 border rounded hover:bg-gray-100"
        >
          취소
        </button>
        <button
          onClick={() => updateMutation.mutate()}
          className="px-6 py-2 bg-[#519d9e] text-white rounded hover:bg-[#407f80]"
        >
          수정 완료
        </button>
      </div>
    </div>
  );
}
