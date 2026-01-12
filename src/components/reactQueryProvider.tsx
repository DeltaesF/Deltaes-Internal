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
            // ✅ [수정] 데이터가 30분 동안은 상하지 않은 것으로 취급 (재요청 안 함)
            staleTime: 1000 * 60 * 30,
            // ✅ [수정] 60분 동안 메모리에 캐시 유지
            gcTime: 1000 * 60 * 60,
            // ✅ [수정] 탭 전환 시 자동 재요청 끄기 (읽기 폭증의 주범 차단)
            refetchOnWindowFocus: false,
            // ✅ [수정] 컴포넌트 다시 마운트 될 때 재요청 끄기
            refetchOnMount: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
