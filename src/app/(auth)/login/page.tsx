"use client";
import { login } from "@/lib/auth";
import { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

// ✅ [설정] 회사의 이메일 도메인을 여기에 입력하세요
const COMPANY_DOMAIN = "@deltaes.co.kr";

export default function Login() {
  const router = useRouter();

  // ✅ email -> userId로 변수명 변경 (아이디만 입력받으므로)
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/main/dashboard/individual");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      // ✅ [핵심 로직]
      // 사용자가 아이디만 입력하면 도메인을 붙여주고,
      // 혹시 이메일 전체를 입력했다면 그대로 사용하도록 처리
      const emailToLogin = userId.includes("@")
        ? userId
        : userId + COMPANY_DOMAIN;

      await login(emailToLogin, password);

      router.replace("/main/dashboard/individual");
    } catch (err) {
      const error = err as FirebaseError;
      // 에러 메시지 사용자 친화적으로 변경 (선택사항)
      let msg = "로그인에 실패했습니다.";
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        msg = "아이디 또는 비밀번호가 올바르지 않습니다.";
      }
      alert(msg);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h2 className="text-3xl font-bold mb-4">Deltaes</h2>
      <form onSubmit={handleLogin} className="flex flex-col gap-2">
        {/* ✅ type="text"로 변경 및 placeholder 수정 */}
        <input
          type="text"
          placeholder="아이디"
          className="border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <input
          type="password"
          placeholder="비밀번호"
          className="border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600 transition-colors font-bold mt-2"
        >
          로그인
        </button>
      </form>
    </div>
  );
}
