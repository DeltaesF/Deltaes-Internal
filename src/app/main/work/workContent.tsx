"use client";

import Link from "next/link";
import { usePathname } from "next/navigation"; // URL 확인용 훅

export default function WorkContent({
  children, // 하위 페이지(daily, weekly 등)가 여기로 들어옵니다.
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname(); // 현재 경로: /main/work/daily 등

  // 현재 경로가 'write' 페이지인지 확인 (탭 버튼 숨기기 용도)
  const isWritePage = pathname.includes("write");

  return (
    <div className="flex flex-col w-full">
      <div className="flex gap-4 mb-6 items-center relative">
        {/* 작성 페이지가 아닐 때만 탭 버튼 표시 */}
        {!isWritePage && (
          <>
            <Link
              href="/main/work/daily"
              className={`px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
                pathname.includes("/daily") && !pathname.includes("write")
                  ? "bg-[#78D2FF] text-black border-[#78D2FF]"
                  : "bg-white border border-[#78D2FF] text-black hover:bg-[#78D2FF] hover:text-white"
              }`}
            >
              일일보고
            </Link>
            <Link
              href="/main/work/weekly"
              className={`px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
                pathname.includes("/weekly") && !pathname.includes("write")
                  ? "bg-[#53F36B] text-black border-[#53F36B]"
                  : "bg-white border border-[#53F36B] text-black hover:bg-[#53F36B] hover:text-white"
              }`}
            >
              주간업무
            </Link>
          </>
        )}
      </div>

      {/* 여기에 실제 페이지 내용(daily/page.tsx 등)이 표시됨 */}
      <div className="w-full">{children}</div>
    </div>
  );
}
