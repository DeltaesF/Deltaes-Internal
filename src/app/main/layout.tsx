// ✅ "use client" 제거해도 됨 (단순 레이아웃)
// html, body, Provider 모두 제거하고 순수 레이아웃만 남깁니다.

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 기존 p-4 md:p-8 대신 가로 너비 제한과 반응형 패딩만 유지
    <div className="w-full h-full p-3 md:p-6 lg:p-10 mx-auto max-w-[1600px]">
      {children}
    </div>
  );
}
