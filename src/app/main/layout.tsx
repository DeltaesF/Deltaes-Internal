// ✅ "use client" 제거해도 됨 (단순 레이아웃)
// html, body, Provider 모두 제거하고 순수 레이아웃만 남깁니다.

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // html, body 태그 삭제함 (상위 레이아웃에서 이미 처리됨)
    <div className="flex w-full min-h-screen">
      {/* 사이드바는 여기서 렌더링 */}
      {/* Sidebar 컴포넌트는 src/app/layout.tsx에서 불러오지 말고 여기서 불러와도 되지만, 
          사용자님의 기존 구조상 Sidebar가 여기에 있어야 자연스럽습니다. 
          하지만 Sidebar에 hook이 있으므로 Sidebar는 클라이언트 컴포넌트로 유지합니다. 
      */}
      {children}
      {/* ❗ 주의: Sidebar를 여기서 부르려면 Sidebar 컴포넌트 import가 필요합니다.
        하지만 아래 src/app/layout.tsx에서 Sidebar를 전역으로 부르고 있으므로
        여기서는 children만 렌더링해도 됩니다.
        
        만약 '로그인 페이지'에는 사이드바가 없어야 한다면,
        src/app/layout.tsx가 아니라 여기에 Sidebar를 넣어야 합니다.
      */}
    </div>
  );
}
