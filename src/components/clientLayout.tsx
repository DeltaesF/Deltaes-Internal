"use client";

import { Provider, useDispatch, useSelector } from "react-redux";
import { store, AppDispatch, RootState } from "@/store";
import { useEffect } from "react";
import { initAuth } from "@/store/slices/authSlice";
import Sidebar from "@/components/sidebar";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import ReactQueryProvider from "@/components/reactQueryProvider";

// ✅ [추가] 인증 보호 컴포넌트 (AuthGuard)
// Provider 내부에서 Redux 상태를 구독하기 위해 분리했습니다.
function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();

  // Redux에서 유저 정보와 로딩 상태 가져오기
  const { user, loading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // 1. 앱 시작 시 인증 초기화
    dispatch(initAuth());

    // 2. 자정 자동 로그아웃 타이머
    const calculateTimeToMidnight = () => {
      const now = new Date();
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0
      );
      return midnight.getTime() - now.getTime();
    };

    const timeToMidnight = calculateTimeToMidnight();
    const timer = setTimeout(async () => {
      try {
        await auth.signOut();
        alert("자정이 경과하여 자동으로 로그아웃 되었습니다.");
        router.push("/login");
      } catch (error) {
        console.error("Logout failed", error);
      }
    }, timeToMidnight);

    return () => clearTimeout(timer);
  }, [dispatch, router]);

  // ✅ [핵심] 로그인 안 한 상태로 보호된 페이지 접근 시 강제 이동
  useEffect(() => {
    // 로딩이 끝났는데 유저 정보가 없고, 현재 페이지가 로그인 페이지가 아니라면
    if (!loading && !user && pathname !== "/login") {
      router.replace("/login"); // 로그인 페이지로 튕겨냄
    }
  }, [user, loading, pathname, router]);

  // 1. 로딩 중일 때는 화면을 보여주지 않고 로딩 표시 (깜빡임 방지)
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-gray-500 font-medium">Delta ES ERP 로딩 중...</div>
      </div>
    );
  }

  // 2. 로그인 안 했는데 메인 페이지에 있다면 (리다이렉트 직전) 빈 화면 반환
  if (!user && pathname !== "/login") {
    return null;
  }

  const isLoginPage = pathname === "/login" || pathname === "/";

  return (
    <div className="flex w-full min-h-screen relative">
      {/* ✅ 로그인 페이지가 아닐 때만 사이드바 표시 */}
      {!isLoginPage && <Sidebar />}

      {/* 메인 콘텐츠 영역 */}
      <main
        className={`flex-1 transition-all duration-300 bg-gray-50 min-h-screen ${
          !isLoginPage
            ? "ml-0 md:ml-[240px] lg:ml-[280px]" // 태블릿 이상부터 사이드바 너비만큼 왼쪽 여백 확보
            : "w-full"
        }`}
      >
        {/* 기존의 h-screen overflow-y-auto는 
          내부 FullCalendar와 충돌하거나 스크롤바가 이중으로 생길 수 있으므로 
          최상위 min-h-screen 구조를 권장합니다.
      */}
        {children}
      </main>
    </div>
  );
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Provider store={store}>
      <ReactQueryProvider>
        {/* AuthGuard로 감싸서 내부에서 로그인 체크 수행 */}
        <AuthGuard>{children}</AuthGuard>
      </ReactQueryProvider>
    </Provider>
  );
}
