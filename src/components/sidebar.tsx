"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store"; // 경로 확인 필요

export default function Sidebar() {
  const pathname = usePathname(); // 현재 URL 확인용
  const router = useRouter();
  const dispatch = useDispatch();

  const { userName } = useSelector(
    (state: RootState) => state.auth || { userName: "사용자" }
  );

  const handleLogout = () => {
    if (window.confirm("로그아웃 하시겠습니까?")) {
      // dispatch(logoutUser()); // 로그아웃 로직
      alert("로그아웃 되었습니다.");
      router.push("/");
    }
  };

  // 메뉴 버튼 스타일 헬퍼
  const getLinkClass = (path: string) => {
    // 현재 URL이 path를 포함하면 활성화 스타일
    const isActive = pathname === path || pathname.startsWith(`${path}/`);
    return `cursor-pointer p-2 rounded-xl transition-all duration-100 w-full block ${
      isActive
        ? "text-white bg-[#519d9e] border-transparent"
        : "text-black bg-white border-[3px] border-[#519d9e] hover:text-white hover:bg-[#519d9e] hover:border-transparent"
    }`;
  };

  return (
    <div className="w-[10%] min-w-[150px] h-screen gap-6 p-4 flex flex-col bg-[#e0e0e0] text-center fixed left-0 top-0 overflow-y-auto z-50">
      <Link href="/main/dashboard/individual">
        <p className="mt-3 font-semibold">{userName || "사용자"}님</p>
      </Link>

      <Link
        href="/main/totalboard/total"
        className={getLinkClass("/main/totalboard/total")}
      >
        게시판
      </Link>

      <Link href="/main/work" className={getLinkClass("/main/work")}>
        업무보고
      </Link>

      <Link href="/main/meeting" className={getLinkClass("/main/meeting")}>
        주간업무회의
      </Link>

      <Link
        href="/main/workoutside/approvals"
        className={getLinkClass("/main/workoutside/approvals")}
      >
        품의서
      </Link>

      <Link
        href="/main/report/posts"
        className={getLinkClass("/main/report/posts")}
      >
        보고서
      </Link>

      <Link
        href="/main/vacation/user"
        className={getLinkClass("/main/vacation/user")}
      >
        휴가원
      </Link>

      <Link
        href="/main/organization"
        className={getLinkClass("/main/organization")}
      >
        조직도
      </Link>
      <button
        onClick={handleLogout}
        className="cursor-pointer border mt-auto bg-white p-2 rounded"
      >
        로그아웃
      </button>
    </div>
  );
}
