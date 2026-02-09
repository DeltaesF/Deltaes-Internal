export default function VacationModal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    // 배경 레이어에 p-4를 추가하여 모바일에서 모달이 화면 끝에 붙지 않게 여백을 줍니다.
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4">
      {/* 1. min-w-0: flex 자식 요소의 최소 너비 해제
          2. w-full: 모바일에서는 가로를 꽉 채움
          3. md:min-w-[700px]: 태블릿/데스크톱(768px 이상)부터는 기존처럼 700px 유지
          4. max-w-[95%] 또는 max-w-4xl: 너무 커지는 것 방지
          5. max-h-[90vh] overflow-y-auto: 내용이 길어질 경우 모달 내부 스크롤 생성
      */}
      <div className="bg-white p-5 md:p-6 rounded-xl shadow-lg relative w-full md:w-auto md:min-w-[700px] max-w-4xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-black text-lg cursor-pointer z-10"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
