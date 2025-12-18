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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 자동 로그아웃 시간 설정 (30분 = 1800000ms / 1시간 = 3600000ms)
  const TIMEOUT_DURATION = 60 * 60 * 1000;

  // 로그아웃 처리 함수
  const handleLogout = useCallback(async () => {
    try {
      await auth.signOut();
      alert("장시간 활동이 없어 안전을 위해 자동 로그아웃 되었습니다.");
      router.push("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  }, [router]);

  // 타이머 리셋 함수 (사용자 활동 감지 시 실행)
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(handleLogout, TIMEOUT_DURATION);
  }, [handleLogout, TIMEOUT_DURATION]);

  useEffect(() => {
    // 앱 시작 시 인증 상태 초기화
    store.dispatch(initAuth());

    // 활동 감지 이벤트 등록
    const events = ["mousemove", "keypress", "click", "scroll"];

    // 이벤트 리스너 등록
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // 초기 타이머 시작
    resetTimer();

    // 정리 (Cleanup)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [resetTimer]); // 의존성 배열에 resetTimer 추가

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
