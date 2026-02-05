"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 1️⃣ [비용 절감 핵심] 데이터의 유통기한을 30분으로 설정
            staleTime: 1000 * 60 * 30,

            // 2️⃣ [메모리 관리] 사용하지 않는 캐시를 60분 동안 유지
            gcTime: 1000 * 60 * 60,

            // 3️⃣ [탭 전환 폭탄 차단] 다른 탭 갔다 와도 절대 재요청 안 함
            refetchOnWindowFocus: false,

            // 4️⃣ [메뉴 이동 폭탄 차단] 메뉴 왔다 갔다 해도 30분 안에는 재요청 안 함
            refetchOnMount: false,

            // 5️⃣ [네트워크 불안정 차단] 인터넷 잠시 끊겼다 연결돼도 재요청 안 함 (추가 추천)
            refetchOnReconnect: false,

            // 에러 발생 시 딱 1번만 다시 시도
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
