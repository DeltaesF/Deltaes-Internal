export default function Daily() {
  return (
    <div className="border rounded-2xl shadow-sm p-4 bg-white">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-[20px] font-semibold">일일 업무 보고서</h3>
        <span className="text-sm text-blue-500 cursor-pointer hover:underline">
          + 더보기
        </span>
      </div>
      <ul>
        <li className="py-2 border-b">일일 업무 보고서 내용 1</li>
        <li className="py-2 border-b">일일 업무 보고서 내용 2</li>
        <li className="py-2 border-b">일일 업무 보고서 내용 3</li>
      </ul>
    </div>
  );
}
