"use client";

import { useEffect, useState } from "react";
import Individual from "./(dashboard)/individual/page";
import Total from "./(totalboard)/total/page";
import Organization from "./organization/page";
import Work from "./work/page";
import Posts from "./(report)/posts/page";
import Approvals from "./(workoutside)/approvals/page";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import UserV from "./(vacation)/user/page";
import { logOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Employee {
  userName: string;
  email: string;
  role: string;
}

export default function Main() {
  const [selectMenu, setSelectMenu] = useState("대쉬보드 이동");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const q = query(
          collection(db, "employee"),
          where("email", "==", user.email)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setEmployee(snap.docs[0].data() as Employee);
        }
        console.log(snap.docs[0]);
      } else {
        setEmployee(null);
      }
    });

    return () => unsubscribe();
  }, []);

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

  const logout = async () => {
    const confirmLogout = window.confirm("로그아웃을 하시겠습니까?");
    if (!confirmLogout) return;

    try {
      await logOut();
      alert("로그아웃이 되었습니다.");
      router.push("/");
    } catch (err) {
      console.error("로그아웃 실패:", err);
    }
  };

  return (
    <div className="flex w-full h-screen overflow-x-hidden box-border">
      <div className="w-[10%] h-full gap-6 p-4 flex flex-col bg-[#f0f0f0] text-center">
        <span
          className="mt-3 cursor-pointer font-semibold"
          onClick={() => setSelectMenu("대쉬보드 이동")}
        >
          {employee?.userName || "사용자"}님
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
        <button onClick={logout} className={"cursor-pointer border"}>
          로그아웃
        </button>
      </div>
      <div className="w-[90%] p-6 ">{renderContent()}</div>
    </div>
  );
}
