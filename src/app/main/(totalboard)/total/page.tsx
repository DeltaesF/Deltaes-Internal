"use client";

export default function Total({
  setSelectMenu,
  setWorkDefaultTab,
}: {
  setSelectMenu: (menu: string) => void;
  setWorkDefaultTab: (tab: "daily" | "weekly") => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 p-6">
      {/* 일일 업무 보고서 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">일일 업무 보고서</h3>
          <span
            className="text-sm text-blue-500 cursor-pointer hover:underline"
            onClick={() => {
              setWorkDefaultTab("daily");
              setSelectMenu("업무보고");
            }}
          >
            + 더보기
          </span>
        </div>
        <ul>
          <li className="py-2 border-b">일일 보고서 내용 1</li>
          <li className="py-2 border-b">일일 보고서 내용 2</li>
          <li className="py-2 border-b">일일 보고서 내용 3</li>
        </ul>
      </div>

      {/* 주간 업무 보고서 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">주간 업무 보고서</h3>
          <span
            className="text-sm text-blue-500 cursor-pointer hover:underline "
            onClick={() => {
              setWorkDefaultTab("weekly");
              setSelectMenu("업무보고");
            }}
          >
            + 더보기
          </span>
        </div>
        <ul>
          <li className="py-2 border-b">주간 보고서 내용 1</li>
          <li className="py-2 border-b">주간 보고서 내용 2</li>
          <li className="py-2 border-b">주간 보고서 내용 3</li>
        </ul>
      </div>

      {/* 공지사항 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">공지사항</h3>
          <span
            className="text-sm text-blue-500 cursor-pointer hover:underline"
            onClick={() => setSelectMenu("공지사항")}
          >
            + 더보기
          </span>
        </div>
        <ul>
          <li className="py-2 border-b">공지사항 1</li>
          <li className="py-2 border-b">공지사항 2</li>
          <li className="py-2 border-b">공지사항 3</li>
        </ul>
      </div>

      {/* 자료실 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">자료실</h3>
          <span
            className="text-sm text-blue-500 cursor-pointer hover:underline"
            onClick={() => setSelectMenu("자료실")}
          >
            + 더보기
          </span>
        </div>
        <ul>
          <li className="py-2 border-b">자료실 자료 1</li>
          <li className="py-2 border-b">자료실 자료 2</li>
          <li className="py-2 border-b">자료실 자료 3</li>
        </ul>
      </div>
    </div>
  );
}
