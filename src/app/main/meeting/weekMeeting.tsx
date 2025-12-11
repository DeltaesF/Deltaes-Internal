"use client";

export default function WorkContent({
  children,
}: {
  children: React.ReactNode;
}) {
  // 현재 경로가 'write' 페이지인지 확인 (탭 버튼 숨기기 용도)

  return (
    <div className="flex flex-col w-full">
      {/* 여기에 실제 페이지 내용(daily/page.tsx 등)이 표시됨 */}
      <div className="w-full">{children}</div>
    </div>
  );
}
