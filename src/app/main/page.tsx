"use client";

import { useState } from "react";
import Individual from "./(dashboard)/individual/page";
import Total from "./(totalboard)/total/page";
import Organization from "./organization/page";
import Work from "./work/page";
import User from "./(vacation)/user/page";
import Posts from "./(report)/posts/page";
import Approvals from "./(workoutside)/approvals/page";

export default function Main() {
  const [selectMenu, setSelectMenu] = useState("대쉬보드 이동");

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
      return <User />;
    } else if (selectMenu === "조직도") {
      return <Organization />;
    }
  };
  return (
    <div className="flex w-full h-screen overflow-x-hidden box-border">
      <div className="w-[10%] h-full gap-6 p-4 flex flex-col bg-[#f0f0f0] text-center">
        <span
          className="mt-3 cursor-pointer"
          onClick={() => setSelectMenu("대쉬보드 이동")}
        >
          000 프로님
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
      </div>
      <div className="w-[90%] p-6 ">{renderContent()}</div>
    </div>
  );
}
