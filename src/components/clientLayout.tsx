"use client";

import { Provider } from "react-redux";
import { store } from "@/store";
import { useEffect } from "react";
import { initAuth } from "@/store/slices/authSlice";
import Sidebar from "@/components/sidebar";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import ReactQueryProvider from "@/components/reactQueryProvider";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 1. 앱 시작 시 인증 및 "날짜 체크" 실행
    store.dispatch(initAuth());

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
  }, [router]);

  // 로그인 페이지인지 확인
  const isLoginPage = pathname === "/login" || pathname === "/";

  return (
    <Provider store={store}>
      <ReactQueryProvider>
        <div className="flex w-full min-h-screen">
          {/* ✅ 로그인 페이지가 아닐 때만 사이드바 표시 */}
          {!isLoginPage && <Sidebar />}

          {/* 메인 콘텐츠 영역 */}
          <div
            className={`flex-1 ${
              !isLoginPage ? "ml-[12%] w-[88%] p-6" : "w-full"
            } bg-gray-50 h-screen overflow-y-auto`}
          >
            {children}
          </div>
        </div>
      </ReactQueryProvider>
    </Provider>
  );
}
