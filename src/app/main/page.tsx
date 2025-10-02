"use client";

import { useEffect, useState } from "react";
import Individual from "./(dashboard)/individual/page";
import Total from "./(totalboard)/total/page";
import Organization from "./organization/page";
import Posts from "./(report)/posts/page";
import Approvals from "./(workoutside)/approvals/page";
import UserV from "./(vacation)/user/page";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import Work from "./(work)/page";

const initAuth = () => ({ type: "auth/initAuth" });
const logoutUser = () => ({ type: "auth/logoutUser" });

export default function Main() {
  const [selectMenu, setSelectMenu] = useState("대쉬보드 이동");
  const router = useRouter();

  // Redux dispatch 함수 가져오기
  const dispatch = useDispatch<AppDispatch>();

  // Redux store에서 auth 상태 가져오기
  // 임시로 기본값을 제공합니다.
  const { userName } = useSelector(
    (state: RootState) => state.auth || { userName: "사용자" }
  );

  // 컴포넌트 마운트 시 initAuth 액션을 디스패치하여 인증 상태 초기화
  useEffect(() => {
    // 실제 앱에서는 dispatch(initAuth())가 비동기 thunk를 호출합니다.
    console.log("인증 초기화 액션 디스패치");
    dispatch(initAuth());
  }, [dispatch]);

  const renderContent = () => {
    if (selectMenu === "대쉬보드 이동") {
      return <Individual />;
    } else if (selectMenu === "게시판") {
      return <Total />;
    } else if (selectMenu === "업무보고") {
      return <Work />;
    } else if (selectMenu === "품의서") {
      return <Approvals />;
    } else if (selectMenu === "보고서") {
      return <Posts />;
    } else if (selectMenu === "휴가원") {
      return <UserV />;
    } else if (selectMenu === "조직도") {
      return <Organization />;
    }
  };

  // logoutUser thunk를 사용하도록 로그아웃 함수 수정
  const handleLogout = async () => {
    const confirmLogout = window.confirm("로그아웃을 하시겠습니까?");
    if (!confirmLogout) return;

    try {
      // 실제 앱에서는 `unwrap()`을 사용하여 promise를 처리합니다.
      // await dispatch(logoutUser()).unwrap();
      console.log("로그아웃 액션 디스패치");
      dispatch(logoutUser());
      alert("로그아웃이 되었습니다.");
      router.push("/");
    } catch (err) {
      console.error("로그아웃 실패:", err);
      alert("로그아웃에 실패했습니다.");
    }
  };

  return (
    <div className="flex w-full h-screen overflow-x-hidden box-border">
      <div className="w-[10%] h-full gap-6 p-4 flex flex-col bg-[#f0f0f0] text-center">
        <span
          className="mt-3 cursor-pointer font-semibold"
          onClick={() => setSelectMenu("대쉬보드 이동")}
        >
          {userName || "사용자"}님
        </span>
        <button
          className={`cursor-pointer p-2 rounded-xl transition-all duration-100
    ${
      selectMenu === "게시판"
        ? "text-white bg-[#519d9e] border-transparent"
        : "text-black bg-white border-[3px] border-[#519d9e] hover:text-white hover:bg-[#519d9e] hover:border-transparent"
    }`}
          onClick={() => setSelectMenu("게시판")}
        >
          게시판
        </button>
        <button
          className={`cursor-pointer p-2 rounded-xl transition-all duration-100
    ${
      selectMenu === "업무보고"
        ? "text-white bg-[#519d9e] border-transparent"
        : "text-black bg-white border-[3px] border-[#519d9e] hover:text-white hover:bg-[#519d9e] hover:border-transparent"
    }`}
          onClick={() => setSelectMenu("업무보고")}
        >
          업무보고
        </button>
        <button
          className={`cursor-pointer p-2 rounded-xl transition-all duration-100
    ${
      selectMenu === "품의서"
        ? "text-white bg-[#519d9e] border-transparent"
        : "text-black bg-white border-[3px] border-[#519d9e] hover:text-white hover:bg-[#519d9e] hover:border-transparent"
    }`}
          onClick={() => setSelectMenu("품의서")}
        >
          품의서
        </button>
        <button
          className={`cursor-pointer p-2 rounded-xl transition-all duration-100
    ${
      selectMenu === "보고서"
        ? "text-white bg-[#519d9e] border-transparent"
        : "text-black bg-white border-[3px] border-[#519d9e] hover:text-white hover:bg-[#519d9e] hover:border-transparent"
    }`}
          onClick={() => setSelectMenu("보고서")}
        >
          보고서
        </button>
        <button
          className={`cursor-pointer p-2 rounded-xl transition-all duration-100
    ${
      selectMenu === "휴가원"
        ? "text-white bg-[#519d9e] border-transparent"
        : "text-black bg-white border-[3px] border-[#519d9e] hover:text-white hover:bg-[#519d9e] hover:border-transparent"
    }`}
          onClick={() => setSelectMenu("휴가원")}
        >
          휴가원
        </button>
        <button
          className={`cursor-pointer p-2 rounded-xl transition-all duration-100
    ${
      selectMenu === "조직도"
        ? "text-white bg-[#519d9e] border-transparent"
        : "text-black bg-white border-[3px] border-[#519d9e] hover:text-white hover:bg-[#519d9e] hover:border-transparent"
    }`}
          onClick={() => setSelectMenu("조직도")}
        >
          조직도
        </button>
        <button onClick={handleLogout} className={"cursor-pointer border"}>
          로그아웃
        </button>
      </div>
      <div className="w-[90%] p-6 ">{renderContent()}</div>
    </div>
  );
}
