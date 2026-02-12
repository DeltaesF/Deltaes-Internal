"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Editor from "@/components/editor";
import { useQueryClient } from "@tanstack/react-query";

const fetchReportDetail = async (id: string) => {
  const res = await fetch("/api/report/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export default function InternalReportEditPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userName } = useSelector((state: RootState) => state.auth);

  const [form, setForm] = useState({
    title: "",
    educationName: "",
    startDate: "",
    endDate: "",
    educationPlace: "",
    educationTime: "",
    usefulness: "보통",
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
          // 기간 분리 (YYYY-MM-DD ~ YYYY-MM-DD 형식 가정)
          const [start, end] = data.educationPeriod
            ? data.educationPeriod.split(" ~ ")
            : ["", ""];

          setForm({
            title: data.title,
            educationName: data.educationName || "",
            startDate: start || "",
            endDate: end || "",
            educationPlace: data.educationPlace || "",
            educationTime: data.educationTime || "",
            usefulness: data.usefulness || "보통",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.educationName)
      return alert("필수 항목을 입력해주세요.");

    setIsLoading(true);

    try {
      const res = await fetch("/api/report/update", {
        method: "POST",
        body: JSON.stringify({
          id,
          userName,
          title: form.title,
          content,

          educationName: form.educationName,
          educationPeriod: `${form.startDate} ~ ${form.endDate}`,
          educationPlace: form.educationPlace,
          educationTime: form.educationTime,
          usefulness: form.usefulness,
        }),
      });

      if (!res.ok) throw new Error("수정 실패");

      // ✅ [중요] router.refresh() 대신 이걸 사용하세요!
      // 'reports'로 시작하는 모든 쿼리(목록)를 즉시 최신화합니다.
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      await queryClient.invalidateQueries({ queryKey: ["reportDetail", id] });

      alert("수정되었습니다.");
      // ✅ 사내교육 상세페이지로 이동
      router.push(`/main/report/${id}`);
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
    <div className="p-4 md:p-6 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-4 md:mt-6">
      {/* 상단 뒤로가기 버튼 */}
      <button
        onClick={() => router.back()}
        className="mb-4 px-4 py-2 border rounded hover:bg-gray-100 text-sm cursor-pointer transition-colors"
      >
        취소
      </button>
      <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-800">
        사내 교육 보고서
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              제목
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              readOnly
              className="w-full border p-2 rounded bg-gray-100 text-gray-600 outline-none cursor-not-allowed"
            />
          </div>

          {/* 교육명 / 교육 장소 - 태블릿(lg) 미만에서는 1열 배치 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                교육명
              </label>
              <input
                type="text"
                name="educationName"
                value={form.educationName}
                onChange={handleChange}
                className="w-full border p-2 rounded focus:ring-1 focus:ring-[#519d9e] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                교육 장소
              </label>
              <input
                type="text"
                name="educationPlace"
                value={form.educationPlace}
                onChange={handleChange}
                className="w-full border p-2 rounded focus:ring-1 focus:ring-[#519d9e] outline-none"
              />
            </div>
          </div>

          {/* 교육 기간 / 교육 시간 - 태블릿(lg) 미만에서는 1열 배치하여 겹침 방지 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                교육 기간
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleChange}
                  className="border p-2 rounded flex-1 min-w-[120px] text-sm md:text-base"
                />
                <span className="shrink-0 text-gray-400">~</span>
                <input
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleChange}
                  className="border p-2 rounded flex-1 min-w-[120px] text-sm md:text-base"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                교육 시간
              </label>
              <input
                type="text"
                name="educationTime"
                value={form.educationTime}
                onChange={handleChange}
                placeholder="예: 13:00 ~ 16:20"
                className="w-full border p-2 rounded focus:ring-1 focus:ring-[#519d9e] outline-none"
              />
            </div>
          </div>
        </div>

        {/* 유용성 평가 - 모바일에서 줄바꿈이 일어날 수 있도록 flex-wrap 적용 */}
        <div className="border p-4 rounded-lg overflow-hidden">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            유용성 평가
          </label>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {["매우좋음", "좋음", "보통", "부족", "매우부족"].map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 cursor-pointer shrink-0"
              >
                <input
                  type="radio"
                  name="usefulness"
                  value={opt}
                  checked={form.usefulness === opt}
                  onChange={handleChange}
                  className="accent-[#519d9e] w-4 h-4"
                />
                <span className="text-sm text-gray-700 font-medium">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            내용
          </label>
          {/* 에디터가 화면 밖으로 나가지 않도록 감싸줌 */}
          <div className="min-h-[300px] bg-white">
            <Editor content={content} onChange={setContent} />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full sm:w-auto self-end px-10 py-3 rounded text-white font-bold transition-colors shadow-sm cursor-pointer ${
            isLoading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#519d9e] hover:bg-[#407f80]"
          }`}
        >
          {isLoading ? "수정 중..." : "수정 완료"}
        </button>
      </form>
    </div>
  );
}
