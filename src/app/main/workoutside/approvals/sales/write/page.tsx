"use client";

import { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// --------------------------------------------------------
// [1] 타입 정의 (구매와 동일)
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
interface SalesFormData {
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

export default function SalesApprovalWrite() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userName } = useSelector((state: RootState) => state.auth);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // --------------------------------------------------------
  // [2] 초기 상태 (판매 품의서 기본값)
  // --------------------------------------------------------
  const [formData, setFormData] = useState<SalesFormData>({
    serialNumber: "DES-250000_판매대상_판매처_R1", // 예시 일련번호 포맷 변경 가능
    writeDate: new Date().toISOString().split("T")[0],
    customerName: "",
    product: "",
    endUser: "",
    customerInfo: "",
    contractDate: "",
    introductionType: "Lease",
    introductionMemo: "",
    deliveryDate: "",
    paymentPending: "무",
    paymentPendingAmount: "",
    billingDate: "",
    cashCollection: "납품",
    cashCollectionDays: "",
    collectionDate: "",
    noteCollection: "납품",
    noteCollectionDays: "",
    noteMaturityDate: "",
    specialNotes: "",
    priceData: {
      list: { orig: "", mod: "" },
      contract: { orig: "", mod: "" },
      dc: { orig: "", mod: "" },
      salesNet: { orig: "", mod: "" },
      profit: { orig: "", mod: "" },
      warranty: { orig: "", mod: "" },
      remarks: "",
    },
    costData: {
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
    attachments: [],
  });

  // --------------------------------------------------------
  // [3] 핸들러
  // --------------------------------------------------------
  const handleCancel = () => {
    const confirmExit = window.confirm(
      "작성 중인 내용이 저장되지 않을 수 있습니다. 정말 나가시겠습니까?"
    );
    if (confirmExit) {
      router.back(); // 뒤로가기 (리스트로 이동)
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePriceChange = (
    key: keyof PriceData,
    field: keyof PriceDetails | "remarks",
    value: string
  ) => {
    setFormData((prev) => {
      if (key === "remarks")
        return { ...prev, priceData: { ...prev.priceData, remarks: value } };
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
    setFormData((prev) => {
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
    setFormData((prev) => {
      const currentTypes = prev.costData.docTypes;
      const exists = currentTypes.includes(type);
      const newTypes = exists
        ? currentTypes.filter((t) => t !== type)
        : [...currentTypes, type];
      return { ...prev, costData: { ...prev.costData, docTypes: newTypes } };
    });
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files)
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // --------------------------------------------------------
  // [4] 전송 로직 (approvalType: "sales")
  // --------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async () => {
      let uploadedAttachments: { name: string; url: string }[] = [];
      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach((file) => formData.append("files", file));
        const uploadRes = await fetch("/api/approvals/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("파일 업로드 실패");
        const uploadData = await uploadRes.json();
        uploadedAttachments = uploadData.files;
      }

      const res = await fetch("/api/approvals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          attachments: uploadedAttachments,
          userName,
          approvalType: "sales", // ✅ [중요] 판매 타입 지정
          title: `[판매품의] ${formData.customerName || "미지정"}_${
            formData.product || "미지정"
          }`,
        }),
      });

      if (!res.ok) throw new Error("저장 실패");
      return res.json();
    },
    onSuccess: async () => {
      // ✅ [핵심 추가] 'approvals' 키를 가진 데이터를 무효화합니다.
      // 이렇게 해야 판매 품의 리스트 페이지로 갔을 때 새로고침 없이 방금 쓴 글이 보입니다.
      await queryClient.invalidateQueries({ queryKey: ["approvals"] });

      alert("판매 품의서가 상신되었습니다.");
      router.push("/main/workoutside/approvals/sales");
    },
    onError: (err) => alert(err.message),
  });

  return (
    <div className="p-8 max-w-5xl mx-auto bg-white min-h-screen pb-20 border rounded-xl shadow-sm mt-6">
      <button
        onClick={handleCancel}
        className="mb-4 px-4 py-2 border rounded hover:bg-gray-100 cursor-pointer text-sm"
      >
        ◀ 취소하고 돌아가기
      </button>
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        📝 판매 품의서 작성
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
                  placeholder="입력"
                />
              </td>
              <th className="bg-gray-100 border p-2 w-32">product</th>
              <td className="border p-2">
                <input
                  name="product"
                  value={formData.product}
                  onChange={handleChange}
                  className="w-full outline-none"
                  placeholder="입력"
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
                  placeholder="메모 (계약/납품/청구 관련 통합)"
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
                    placeholder="금액"
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

        {/* Table 3: 비용 정보 (✅ 수정됨) */}
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

            {/* ✅ 소계 및 첨부서류 다중 선택 (1번 항목 상세 분리) */}
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
              <td className="border p-2 text-left bg-blue-50" rowSpan={3}>
                <p className="font-bold text-xs mb-2 text-blue-800">
                  [증빙서류 선택]
                </p>
                <div className="flex flex-col gap-2 text-xs">
                  {/* 1. 증빙서류 그룹 (1. 텍스트와 체크박스들을 분리하여 정렬) */}
                  <div className="flex items-start gap-1">
                    <span className="font-bold mr-1">1.</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {["견적서", "물품명세", "발주서", "계약서"].map((doc) => (
                        <label
                          key={doc}
                          className="flex items-center gap-1 cursor-pointer hover:text-blue-600"
                        >
                          <input
                            type="checkbox"
                            checked={formData.costData.docTypes.includes(doc)}
                            onChange={() => handleDocTypeToggle(doc)}
                            className="accent-blue-600"
                          />
                          {doc}
                        </label>
                      ))}
                    </div>
                  </div>
                  {/* 2. 운송협조전 */}
                  <div className="flex items-center gap-1">
                    <span className="font-bold mr-1">2.</span>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600">
                      <input
                        type="checkbox"
                        checked={formData.costData.docTypes.includes(
                          "운송협조전"
                        )}
                        onChange={() => handleDocTypeToggle("운송협조전")}
                        className="accent-blue-600"
                      />
                      운송협조전
                    </label>
                  </div>

                  {/* 3. 설치요청서 */}
                  <div className="flex items-center gap-1">
                    <span className="font-bold mr-1">3.</span>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600">
                      <input
                        type="checkbox"
                        checked={formData.costData.docTypes.includes(
                          "설치요청서"
                        )}
                        onChange={() => handleDocTypeToggle("설치요청서")}
                        className="accent-blue-600"
                      />
                      설치요청서
                    </label>
                  </div>
                </div>
              </td>
            </tr>

            {/* 합계 */}
            <tr>
              <th className="bg-gray-100 border p-2">합계</th>
              <td className="border p-2 font-bold bg-blue-50" colSpan={2}>
                <input
                  value={formData.costData.total.val}
                  onChange={(e) =>
                    handleCostChange("total", "val", e.target.value)
                  }
                  className="w-full text-center bg-transparent outline-none"
                  placeholder="실질+명목 합계"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ✅ [추가] 파일 업로드 영역 */}
      <div className="mt-6 border p-4 rounded-lg bg-gray-50">
        <h3 className="font-bold text-gray-700 mb-2">
          📎 파일 첨부 (여러 개 선택 가능)
        </h3>
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {/* 선택된 파일 목록 */}
        {selectedFiles.length > 0 && (
          <ul className="mt-3 space-y-1">
            {selectedFiles.map((file, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between text-xs bg-white p-2 rounded border"
              >
                <span>
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
                <button
                  onClick={() => removeFile(idx)}
                  className="text-red-500 hover:text-red-700 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 border rounded hover:bg-gray-100 cursor-pointer"
        >
          취소
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="px-6 py-2 bg-[#519d9e] text-white rounded hover:bg-[#407f80] disabled:bg-gray-400 cursor-pointer"
        >
          {createMutation.isPending ? "상신 중..." : "상신하기"}
        </button>
      </div>
    </div>
  );
}
