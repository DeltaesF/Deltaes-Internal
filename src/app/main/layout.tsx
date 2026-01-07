"use client";

import { Provider } from "react-redux";
import { store } from "@/store";
import { useCallback, useEffect, useRef } from "react";
import { initAuth } from "@/store/slices/authSlice";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/sidebar";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  // ✅ [수정] 자정 자동 로그아웃 로직
  useEffect(() => {
    // 앱 시작 시 인증 상태 초기화
    store.dispatch(initAuth());

    // 자정까지 남은 시간 계산
    const calculateTimeToMidnight = () => {
      const now = new Date();
      // 내일 날짜의 0시 0분 0초
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
        alert(
          "자정이 경과하여 자동으로 로그아웃 되었습니다.\n내일 업무를 위해 다시 로그인해주세요."
        );
        router.push("/login");
      } catch (error) {
        console.error("Logout failed", error);
      }
    }, timeToMidnight);

    return () => clearTimeout(timer);
  }, [router]); // 의존성 배열에서 기타 감지 로직 제거
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Provider로 store 주입 */}
        <Provider store={store}>
          <div className="flex w-full min-h-screen">
            {/* 사이드바는 항상 왼쪽에 고정 */}
            <Sidebar />

            {/* 오른쪽 90% 영역에 페이지 내용(children)이 바뀜 */}
            <div className="flex-1 ml-[10%] w-[90%] p-6 bg-gray-50 h-screen overflow-y-auto">
              {children}
            </div>
          </div>
        </Provider>
      </body>
    </html>
  );
}
