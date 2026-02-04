"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { useState, useEffect } from "react";
import PasswordChangeModal from "./passwordChangeModal";
import { logoutUser } from "@/store/slices/authSlice";

// 아이콘(선택사항)
const ARROW_DOWN = "▼";
const ARROW_UP = "▲";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  const { userName, role } = useSelector(
    (state: RootState) => state.auth || { userName: "사용자" }
  );

  // 대분류 상태
  const [openCategory, setOpenCategory] = useState<
    "approval" | "management" | null
  >(null);

  // [추가] 모바일 메뉴 열림/닫힘 상태
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // 중분류 상태 (업무 관리 내부)
  const [subMenus, setSubMenus] = useState({
    company: false, // 내부소식
    work: false, // 업무보고
    meeting: false, // 영업회의
    approvalDocs: false, // 품의서 (업무결재 내부)
    reports: false, // 보고서
  });

  const [isPwModalOpen, setIsPwModalOpen] = useState(false);

  // 현재 경로에 따라 자동으로 메뉴 열기
  useEffect(() => {
    // [추가] 페이지 이동 시 모바일 메뉴 닫기
    setIsMobileOpen(false);

    if (
      pathname.includes("/my-approval") ||
      pathname.includes("/workoutside/approvals")
    ) {
      setOpenCategory("approval");
      if (pathname.includes("/workoutside/approvals"))
        toggleSubMenu("approvalDocs", true);
    } else if (
      pathname.includes("/notice") ||
      pathname.includes("/resources") ||
      pathname.includes("/work/") ||
      pathname.includes("/meeting/") ||
      pathname.includes("/report/") ||
      pathname.includes("/vacation") ||
      pathname.includes("/organization")
    ) {
      setOpenCategory("management");
      // 중분류 자동 오픈 로직
      if (pathname.includes("/notice") || pathname.includes("/resources"))
        toggleSubMenu("company", true);
      if (pathname.includes("/work/")) toggleSubMenu("work", true);
      if (pathname.includes("/meeting/")) toggleSubMenu("meeting", true);
      if (pathname.includes("/report/")) toggleSubMenu("reports", true);
    }
  }, [pathname]);

  const toggleCategory = (category: "approval" | "management") => {
    setOpenCategory((prev) => (prev === category ? null : category));
  };

  const toggleSubMenu = (key: keyof typeof subMenus, forceState?: boolean) => {
    setSubMenus((prev) => ({
      ...prev,
      [key]: forceState !== undefined ? forceState : !prev[key],
    }));
  };

  const handleLogout = () => {
    if (window.confirm("로그아웃 하시겠습니까?")) {
      dispatch(logoutUser());
      alert("로그아웃 되었습니다.");
      router.push("/");
    }
  };

  // 스타일 헬퍼
  const getMainCategoryClass = (category: string) => {
    const isOpen = openCategory === category;
    return `cursor-pointer p-3 rounded-xl transition-all duration-200 w-full flex justify-between items-center font-bold text-lg mb-2 ${
      isOpen
        ? "bg-[#519d9e] text-white shadow-md"
        : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
    }`;
  };

  const getSubCategoryClass = (isActive: boolean) => {
    return `cursor-pointer p-2 rounded-lg text-sm font-semibold flex justify-between items-center transition-colors mb-1 ${
      isActive
        ? "bg-gray-100 text-[#519d9e] border-l-4 border-[#519d9e]"
        : "text-gray-600 hover:bg-gray-50 hover:text-black"
    }`;
  };

  const getLinkClass = (path: string) => {
    const isActive = pathname === path || pathname.startsWith(`${path}/`);
    return `block text-sm p-2 ml-2 rounded-md transition-colors ${
      isActive
        ? "text-[#519d9e] font-bold bg-white shadow-sm"
        : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
    }`;
  };

  const isSalesTeam =
    userName?.includes("영업") || role === "supervisor" || role === "ceo";

  return (
    <>
      {/* [추가] 모바일 햄버거 버튼 (화면 왼쪽 상단 고정, 데스크탑에선 숨김) */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-4 left-4 z-[60] p-2 bg-white rounded-lg shadow-md border border-gray-200 text-gray-600"
      >
        {isMobileOpen ? "✕" : "☰"}
      </button>

      {/* [추가] 모바일 오버레이 (메뉴 열렸을 때 배경 어둡게 처리) */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[49] md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* [수정] 사이드바 컨테이너: 반응형 클래스 적용 */}
      <div
        className={`
        fixed top-0 left-0 h-screen bg-[#f5f7fa] border-r border-gray-200 overflow-y-auto z-50 scrollbar-hide p-4 flex flex-col
        transition-transform duration-300 ease-in-out
        
        /* 👇 [핵심 수정] 너비를 260px로 고정합니다 */
        w-[260px]
        
        /* 모바일에서는 숨김(-translate-x-full), PC(md 이상)에서는 항상 보임(translate-x-0) */
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
      `}
      >
        {/* 사용자 정보 */}
        {/* [수정] 모바일에서는 상단 햄버거 버튼과 겹치지 않게 여백 추가 */}
        <div className="mb-6 text-center mt-12 md:mt-0">
          <Link href="/main/dashboard/individual" prefetch={false}>
            <div className="w-16 h-16 bg-[#519d9e] rounded-full mx-auto mb-2 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {userName ? userName[0] : "U"}
            </div>
            <p className="font-bold text-gray-800">{userName || "사용자"}님</p>
            <p className="text-xs text-gray-500">
              {role === "admin"
                ? "관리자"
                : role === "supervisor"
                ? "결재자"
                : "사원"}
            </p>
          </Link>
        </div>

        {role === "admin" && (
          <Link
            href="/main/supervisor/employees"
            prefetch={false}
            className="mb-4 block text-center p-2 rounded-lg bg-gray-800 text-white text-sm font-bold hover:bg-black transition-colors"
          >
            ⚙️ 관리자 페이지
          </Link>
        )}

        {/* ======================= 1. 업무 결재 그룹 ======================= */}
        <div className="mb-2">
          <div
            onClick={() => toggleCategory("approval")}
            className={getMainCategoryClass("approval")}
          >
            <span>📑 업무 결재</span>
            <span className="text-xs">
              {openCategory === "approval" ? ARROW_UP : ARROW_DOWN}
            </span>
          </div>

          {openCategory === "approval" && (
            <div className="flex flex-col gap-1 pl-2 mb-4 animate-fadeIn">
              <Link
                href="/main/my-approval/pending"
                prefetch={false}
                className={getLinkClass("/main/my-approval/pending")}
              >
                • 결재 대기함
              </Link>
              <Link
                href="/main/my-approval/completed"
                prefetch={false}
                className={getLinkClass("/main/my-approval/completed")}
              >
                • 결재 완료함
              </Link>
              <Link
                href="/main/my-approval/shared"
                prefetch={false}
                className={getLinkClass("/main/my-approval/shared")}
              >
                • 수신 / 공유함
              </Link>

              {/* 품의서 (하위 그룹) */}
              <div className="mt-1">
                <div
                  onClick={() => toggleSubMenu("approvalDocs")}
                  className={getSubCategoryClass(subMenus.approvalDocs)}
                >
                  <span>품의서</span>
                  <span className="text-xs">
                    {subMenus.approvalDocs ? ARROW_UP : ARROW_DOWN}
                  </span>
                </div>
                {subMenus.approvalDocs && (
                  <div className="pl-3 border-l border-gray-300 ml-2 space-y-1">
                    <Link
                      href="/main/workoutside/approvals/purchase"
                      prefetch={false}
                      className={getLinkClass(
                        "/main/workoutside/approvals/purchase"
                      )}
                    >
                      - 구매품의서
                    </Link>
                    <Link
                      href="/main/workoutside/approvals/sales"
                      prefetch={false}
                      className={getLinkClass(
                        "/main/workoutside/approvals/sales"
                      )}
                    >
                      - 판매품의서
                    </Link>
                    <Link
                      href="/main/workoutside/approvals/vehicle"
                      prefetch={false}
                      className={getLinkClass(
                        "/main/workoutside/approvals/vehicle"
                      )}
                    >
                      - 외근/출장 신청서
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ======================= 2. 업무 관리 그룹 ======================= */}
        <div className="mb-2">
          <div
            onClick={() => toggleCategory("management")}
            className={getMainCategoryClass("management")}
          >
            <span>💼 업무 관리</span>
            <span className="text-xs">
              {openCategory === "management" ? ARROW_UP : ARROW_DOWN}
            </span>
          </div>

          {openCategory === "management" && (
            <div className="flex flex-col gap-1 pl-2 animate-fadeIn">
              {/* 내부 소식 */}
              <div>
                <div
                  onClick={() => toggleSubMenu("company")}
                  className={getSubCategoryClass(subMenus.company)}
                >
                  <span>내부 소식</span>
                  <span className="text-xs">
                    {subMenus.company ? ARROW_UP : ARROW_DOWN}
                  </span>
                </div>
                {subMenus.company && (
                  <div className="pl-3 border-l border-gray-300 ml-2 space-y-1">
                    <Link
                      href="/main/notice"
                      prefetch={false}
                      className={getLinkClass("/main/notice")}
                    >
                      - 공지사항
                    </Link>
                    <Link
                      href="/main/resources"
                      prefetch={false}
                      className={getLinkClass("/main/resources")}
                    >
                      - 자료실
                    </Link>
                  </div>
                )}
              </div>

              {/* 업무 보고 */}
              <div>
                <div
                  onClick={() => toggleSubMenu("work")}
                  className={getSubCategoryClass(subMenus.work)}
                >
                  <span>업무 보고</span>
                  <span className="text-xs">
                    {subMenus.work ? ARROW_UP : ARROW_DOWN}
                  </span>
                </div>
                {subMenus.work && (
                  <div className="pl-3 border-l border-gray-300 ml-2 space-y-1">
                    <Link
                      href="/main/work/daily"
                      prefetch={false}
                      className={getLinkClass("/main/work/daily")}
                    >
                      - 일일업무보고
                    </Link>
                    <Link
                      href="/main/work/weekly"
                      prefetch={false}
                      className={getLinkClass("/main/work/weekly")}
                    >
                      - 주간업무보고
                    </Link>
                  </div>
                )}
              </div>

              {/* 영업 회의 */}
              <div>
                <div
                  onClick={() => toggleSubMenu("meeting")}
                  className={getSubCategoryClass(subMenus.meeting)}
                >
                  <span>영업 회의</span>
                  <span className="text-xs">
                    {subMenus.meeting ? ARROW_UP : ARROW_DOWN}
                  </span>
                </div>
                {subMenus.meeting && (
                  <div className="pl-3 border-l border-gray-300 ml-2 space-y-1">
                    {isSalesTeam ? (
                      <Link
                        href="/main/meeting/weekly-sales/sales"
                        prefetch={false}
                        className={getLinkClass("/main/meeting/weekly-sales")}
                      >
                        - 주간 영업 보고
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400 p-2 block">
                        권한이 없습니다.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 보고서 */}
              <div>
                <div
                  onClick={() => toggleSubMenu("reports")}
                  className={getSubCategoryClass(subMenus.reports)}
                >
                  <span>보고서</span>
                  <span className="text-xs">
                    {subMenus.reports ? ARROW_UP : ARROW_DOWN}
                  </span>
                </div>
                {subMenus.reports && (
                  <div className="pl-3 border-l border-gray-300 ml-2 space-y-1">
                    <Link
                      href="/main/report/internal"
                      prefetch={false}
                      className={getLinkClass("/main/report/internal")}
                    >
                      - 사내교육보고서
                    </Link>
                    <Link
                      href="/main/report/external"
                      prefetch={false}
                      className={getLinkClass("/main/report/external")}
                    >
                      - 외부교육보고서
                    </Link>
                  </div>
                )}
              </div>

              {/* 휴가원 & 조직도 (단일 메뉴) */}
              <Link
                href="/main/vacation/user"
                prefetch={false}
                className={`${getLinkClass("/main/vacation/user")} mt-2`}
              >
                🏖️ 휴가원
              </Link>

              <Link
                href="/main/organization"
                prefetch={false}
                className={getLinkClass("/main/organization")}
              >
                🏢 조직도
              </Link>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-gray-300">
          <button
            onClick={() => setIsPwModalOpen(true)}
            className="w-full text-left p-2 rounded text-sm text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-2 cursor-pointer"
          >
            🔒 비밀번호 변경
          </button>

          <button
            onClick={handleLogout}
            className="w-full text-left p-2 rounded text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2 font-semibold cursor-pointer"
          >
            🚪 로그아웃
          </button>
        </div>

        {isPwModalOpen && (
          <PasswordChangeModal onClose={() => setIsPwModalOpen(false)} />
        )}
      </div>
    </>
  );
}
