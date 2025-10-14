type Props = {
  onCancel: () => void;
};

export default function ReportWrite({ onCancel }: Props) {
  const handleCancel = () => {
    const confirmExit = window.confirm(
      "작성 중인 내용이 저장되지 않을 수 있습니다. 정말 나가시겠습니까?"
    );
    if (confirmExit) {
      onCancel();
    }
  };

  return (
    <div>
      <button onClick={handleCancel} className="mb-4 px-4 py-2 border rounded">
        ◀ 나가기
      </button>

      <h2>📊 보고서 작성</h2>

      <form className="flex flex-col gap-4 mt-4">
        <input
          type="text"
          placeholder="보고서 제목"
          className="border p-2 rounded"
        />
        <textarea
          placeholder="보고서 내용"
          className="border p-2 rounded h-40"
        ></textarea>
        <button
          type="submit"
          className="bg-[#519d9e] text-white px-4 py-2 rounded"
        >
          작성
        </button>
      </form>
    </div>
  );
}
