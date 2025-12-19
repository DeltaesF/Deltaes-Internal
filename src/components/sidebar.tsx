"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store"; // 경로 확인 필요
import { useState } from "react";
import PasswordChangeModal from "./passwordChangeModal";
import { logoutUser } from "@/store/slices/authSlice";

export default function Sidebar() {
  const pathname = usePathname(); // 현재 URL 확인용
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  const { userName, role } = useSelector(
    (state: RootState) => state.auth || { userName: "사용자" }
  );

  const [isMyApprovalOpen, setIsMyApprovalOpen] = useState(false);
  const [isWorkOpen, setIsWorkOpen] = useState(false);
  const [isMeetingOpen, setIsMeetingOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isApprovalsOpen, setIsApprovalsOpen] = useState(false);
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const [isPwModalOpen, setIsPwModalOpen] = useState(false);

  const handleLogout = () => {
    if (window.confirm("로그아웃 하시겠습니까?")) {
      dispatch(logoutUser()); // 로그아웃 로직
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

  const getSubLinkClass = (pathSegment: string) => {
    // 현재 URL에 해당 경로가 포함되어 있는지 확인 (예: /main/work/dailywrite 도 /work/daily 에 포함됨)
    const isActive = pathname.includes(pathSegment);
    return `text-sm p-2 rounded-lg border-2 block transition-colors ${
      isActive
        ? "bg-[#519d9e] text-white border-[#519d9e]" // 활성화 시 색상
        : "bg-white border-gray-300 text-black hover:bg-gray-200" // 비활성화 시 스타일
    }`;
  };

  const isSalesTeam =
    userName?.includes("영업") || role === "supervisor" || role === "ceo";

  return (
    <div className="w-[10%] min-w-[150px] h-screen gap-6 p-4 flex flex-col bg-[#e0e0e0] text-center fixed left-0 top-0 overflow-y-auto z-50">
      <Link href="/main/dashboard/individual">
        <p className="mt-3 font-semibold">{userName || "사용자"}님</p>
      </Link>

      {role === "supervisor" && (
        <Link
          href="/main/supervisor/employees"
          className={getLinkClass("/main/supervisor/employees")}
        >
          관리자 페이지
        </Link>
      )}

      <div className="w-full">
        <div
          onClick={() => setIsMyApprovalOpen(!isMyApprovalOpen)}
          className="cursor-pointer p-2 rounded-xl bg-white border-[3px] border-[#519d9e] text-black font-semibold hover:bg-gray-200 mb-2"
        >
          나의 결재함 ▼
        </div>
        {isMyApprovalOpen && (
          <div className="flex flex-col gap-2 pl-2">
            <Link
              href="/main/my-approval/pending"
              className={getSubLinkClass("/my-approval/pending")}
            >
              결재 대기함
            </Link>
            <Link
              href="/main/my-approval/completed"
              className={getSubLinkClass("/my-approval/completed")}
            >
              결재 완료함
            </Link>
            <Link
              href="/main/my-approval/shared"
              className={getSubLinkClass("/my-approval/shared")}
            >
              수신/공유함
            </Link>
          </div>
        )}
      </div>

      <div className="w-full">
        <div
          onClick={() => setIsCompanyOpen(!isCompanyOpen)}
          className="cursor-pointer p-2 rounded-xl bg-white border-[3px] border-[#519d9e] text-black font-semibold hover:bg-gray-200 mb-2"
        >
          내부 소식▼
        </div>

        {isCompanyOpen && (
          <div className="flex flex-col gap-2 pl-2">
            <Link href="/main/notice" className={getSubLinkClass("/notice")}>
              공지사항
            </Link>

            <Link
              href="/main/resources"
              className={getSubLinkClass("/work/resources")}
            >
              자료실
            </Link>
          </div>
        )}
      </div>

      {/* <Link
        href="/main/totalboard/total"
        className={getLinkClass("/main/totalboard/total")}
      >
        게시판
      </Link> */}

      <div className="w-full">
        <div
          onClick={() => setIsWorkOpen(!isWorkOpen)}
          className="cursor-pointer p-2 rounded-xl bg-white border-[3px] border-[#519d9e] text-black font-semibold hover:bg-gray-200 mb-2"
        >
          업무보고 ▼
        </div>

        {isWorkOpen && (
          <div className="flex flex-col gap-2 pl-2">
            <Link
              href="/main/work/daily"
              className={getSubLinkClass("/work/daily")}
            >
              일일업무보고
            </Link>

            <Link
              href="/main/work/weekly"
              className={getSubLinkClass("/work/weekly")}
            >
              주간업무보고
            </Link>
          </div>
        )}
      </div>

      <div className="w-full">
        <div
          onClick={() => setIsMeetingOpen(!isMeetingOpen)}
          className="cursor-pointer p-2 rounded-xl bg-white border-[3px] border-[#519d9e] text-black font-semibold hover:bg-gray-200 mb-2"
        >
          주간영업회의 ▼
        </div>

        {isMeetingOpen && (
          <div className="flex flex-col gap-2 pl-2">
            {isSalesTeam && (
              <Link
                href="/main/meeting/weekly-sales/sales"
                className={getSubLinkClass("/meeting/weekly-sales")}
              >
                주간 영업 보고
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="w-full">
        <div
          onClick={() => setIsApprovalsOpen(!isApprovalsOpen)}
          className="cursor-pointer p-2 rounded-xl bg-white border-[3px] border-[#519d9e] text-black font-semibold hover:bg-gray-200 mb-2"
        >
          품의서 ▼
        </div>

        {isApprovalsOpen && (
          <div className="flex flex-col gap-2 pl-2">
            <Link
              href="/main/workoutside/approvals"
              className={getSubLinkClass("/workoutside/approvals")}
            >
              구매품의서
            </Link>

            <Link
              href="/main/workoutside/approvals"
              className={getSubLinkClass("/workoutside/approvals/d")}
            >
              판매품의서
            </Link>
          </div>
        )}
      </div>

      <div className="w-full">
        <div
          onClick={() => setIsReportOpen(!isReportOpen)}
          className="cursor-pointer p-2 rounded-xl bg-white border-[3px] border-[#519d9e] text-black font-semibold hover:bg-gray-200 mb-2"
        >
          보고서 ▼
        </div>

        {isReportOpen && (
          <div className="flex flex-col gap-2 pl-2">
            <Link
              href="/main/report/posts"
              className={getSubLinkClass("/report/posts")}
            >
              사내교육보고서
            </Link>

            <Link
              href="/main/report/posts"
              className={getSubLinkClass("/report/posts/d")}
            >
              외부교육보고서
            </Link>

            <Link
              href="/main/report/posts"
              className={getSubLinkClass("/report/posts/dd")}
            >
              외근 및 법인차량
            </Link>
          </div>
        )}
      </div>

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
      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={() => setIsPwModalOpen(true)}
          className="cursor-pointer border bg-white p-2 rounded text-sm hover:bg-gray-100 text-gray-700"
        >
          🔒 비밀번호 변경
        </button>

        <button
          onClick={handleLogout}
          className="cursor-pointer border bg-white p-2 rounded text-red-500 hover:bg-red-50 font-medium"
        >
          로그아웃
        </button>
      </div>
      {isPwModalOpen && (
        <PasswordChangeModal onClose={() => setIsPwModalOpen(false)} />
      )}
    </div>
  );
}
