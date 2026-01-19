"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Editor from "@/components/editor";

const fetchReportDetail = async (id: string) => {
  const res = await fetch("/api/approvals/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export default function VehicleReportEditPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { userName } = useSelector((state: RootState) => state.auth);

  const [form, setForm] = useState({
    title: "",
    contact: "",
    isExternalWork: false,
    isVehicleUse: false,
    implementDate: "",
    vehicleModel: "",
    usageStart: "",
    usageEnd: "",
    createdAt: "", // 기안일자 표시용
  });

  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // 데이터 불러오기
  useEffect(() => {
    if (id) {
      fetchReportDetail(id)
        .then((data) => {
          if (userName && data.userName !== userName) {
            alert("수정 권한이 없습니다.");
            router.back();
            return;
          }

          // 사용일시 분리 로직 ("YYYY-MM-DD HH:mm ~ YYYY-MM-DD HH:mm")
          let start = "",
            end = "";
          if (data.usagePeriod) {
            const parts = data.usagePeriod.split(" ~ ");
            if (parts.length === 2) {
              // input type="datetime-local"은 "YYYY-MM-DDTHH:mm" 형식을 원함
              start = parts[0].trim().replace(" ", "T");
              end = parts[1].trim().replace(" ", "T");
            }
          }

          // 기안일자 포맷팅
          const createdDate = new Date(data.createdAt);
          const createdDateStr = `${createdDate.getFullYear()}.${String(
            createdDate.getMonth() + 1
          ).padStart(2, "0")}.${String(createdDate.getDate()).padStart(
            2,
            "0"
          )}`;

          setForm({
            title: data.title,
            contact: data.contact || "",
            isExternalWork: data.isExternalWork || false,
            isVehicleUse: data.isVehicleUse || false,
            implementDate: data.implementDate || "",
            vehicleModel: data.vehicleModel || "",
            usageStart: start,
            usageEnd: end,
            createdAt: createdDateStr,
          });

          setContent(data.content || "");
        })
        .catch((err) => {
          console.error(err);
          alert("데이터를 불러오는데 실패했습니다.");
          router.back();
        })
        .finally(() => setIsFetching(false));
    }
  }, [id, userName, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title || !form.contact || !form.usageStart || !form.usageEnd) {
      return alert("필수 항목을 입력해주세요.");
    }

    const usagePeriod = `${form.usageStart.replace(
      "T",
      " "
    )} ~ ${form.usageEnd.replace("T", " ")}`;

    setIsLoading(true);

    try {
      const res = await fetch("/api/approvals/update", {
        method: "POST",
        body: JSON.stringify({
          id,
          userName,
          title: form.title,
          content,

          // 차량용 필드
          contact: form.contact,
          isExternalWork: form.isExternalWork,
          isVehicleUse: form.isVehicleUse,
          implementDate: form.implementDate,
          vehicleModel: form.vehicleModel,
          usagePeriod: usagePeriod,
        }),
      });

      if (!res.ok) throw new Error("수정 실패");

      alert("수정되었습니다.");
      router.push(`/main/workoutside/approvals/${id}`);
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching)
    return <div className="p-10 text-center">데이터 불러오는 중...</div>;

  return (
    <div className="p-6 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-6">
      <button
        onClick={() => router.back()}
        className="mb-4 px-4 py-2 border rounded hover:bg-gray-100 text-sm cursor-pointer"
      >
        취소
      </button>
      <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-4">
        📝 외근 및 법인차량 이용 신청서 수정
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 1. 기본 정보 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-gray-700">신청자</span>
            <input
              type="text"
              value={userName || ""}
              readOnly
              className="border p-2 rounded bg-gray-100 text-gray-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-gray-700">
              연락처 <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              name="contact"
              value={form.contact}
              onChange={handleChange}
              placeholder="예: 010-1234-5678"
              className="border p-2 rounded focus:ring-2 focus:ring-[#519d9e]"
            />
          </div>
        </div>

        {/* 2. 구분 (체크박스) */}
        <div className="flex gap-6 items-center bg-gray-50 p-4 rounded-lg border">
          <span className="text-sm font-bold text-gray-700">구분:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="isExternalWork"
              checked={form.isExternalWork}
              onChange={handleCheckboxChange}
              className="w-5 h-5 accent-[#519d9e]"
            />
            <span>외근</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="isVehicleUse"
              checked={form.isVehicleUse}
              onChange={handleCheckboxChange}
              className="w-5 h-5 accent-[#519d9e]"
            />
            <span>차량사용</span>
          </label>
        </div>

        {/* 3. 날짜 및 차량 정보 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              기안일자
            </label>
            <input
              type="text"
              value={form.createdAt}
              readOnly
              className="w-full border p-2 rounded bg-gray-100 text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              시행일자
            </label>
            <input
              type="date"
              name="implementDate"
              value={form.implementDate}
              onChange={handleChange}
              className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e]"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            이용차량
          </label>
          <input
            type="text"
            name="vehicleModel"
            value={form.vehicleModel}
            onChange={handleChange}
            className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e]"
          />
          <p className="text-xs text-gray-500 mt-1">
            * 개인차량 or 대중교통 이용 시에도 기재 필수
          </p>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            사용일시 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="datetime-local"
              name="usageStart"
              value={form.usageStart}
              onChange={handleChange}
              className="border p-2 rounded flex-1"
            />
            <span>~</span>
            <input
              type="datetime-local"
              name="usageEnd"
              value={form.usageEnd}
              onChange={handleChange}
              className="border p-2 rounded flex-1"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            제목 (외근 목적) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="예: 거래처 미팅 및 현장 점검"
            className="w-full border p-2 rounded focus:ring-2 focus:ring-[#519d9e]"
          />
        </div>

        {/* 4. 상세 내용 (에디터) */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            상세 내용
          </label>
          <Editor content={content} onChange={setContent} />
        </div>

        {/* 6. 이용 수칙 (단순 표시용 - 수정 시에는 읽기 전용으로 노출) */}
        <div className="border rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
          <h4 className="font-bold mb-2">📌 법인차량 이용수칙</h4>
          <ul className="list-decimal list-inside space-y-1 text-xs text-gray-600">
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
          <div className="mt-4 border-t pt-2 text-center">
            <span className="text-xs font-bold text-gray-500">
              ※ 최초 작성 시 위 이용수칙에 동의하였습니다.
            </span>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 rounded text-gray-700 font-bold hover:bg-gray-300 transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-[#519d9e] text-white rounded font-bold hover:bg-[#407f80] transition-colors shadow-md cursor-pointer"
          >
            {isLoading ? "수정 중..." : "수정 완료"}
          </button>
        </div>
      </form>
    </div>
  );
}
