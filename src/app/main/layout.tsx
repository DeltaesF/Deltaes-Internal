// ✅ "use client" 제거해도 됨 (단순 레이아웃)
// html, body, Provider 모두 제거하고 순수 레이아웃만 남깁니다.

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="w-full h-full p-4 md:p-8 lg:p-10">{children}</div>
    </div>
  );
}
