"use client";

import { Provider } from "react-redux";
import { store } from "@/store";
import { useEffect } from "react";
import { initAuth } from "@/store/slices/authSlice";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/sidebar";

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
  useEffect(() => {
    // 앱 시작 시 인증 상태 초기화
    store.dispatch(initAuth());
  }, []);

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
