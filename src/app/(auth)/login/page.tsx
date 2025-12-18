"use client";
import { login } from "@/lib/auth";
import { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 이미 로그인 되어있다면 메인으로 강제 이동 (기록 안 남김)
        router.replace("/main/dashboard/individual");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleEmailLogin = async (e?: React.FormEvent) => {
    e?.preventDefault(); // form 기본 제출 동작 방지
    try {
      await login(email, password);
      // alert("로그인 성공!"); // (선택사항) 부드러운 이동을 위해 alert 제거 가능

      // ✅ [수정] push -> replace (뒤로가기 시 로그인 페이지가 나오지 않게 함)
      router.replace("/main/dashboard/individual");
    } catch (err) {
      const error = err as FirebaseError;
      alert("로그인 실패: " + error.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h2 className="text-3xl font-bold mb-4">Deltaes</h2>
      <form onSubmit={handleEmailLogin} className="flex flex-col gap-2">
        <input
          type="email"
          placeholder="이메일"
          className="border px-2 py-1 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="비밀번호"
          className="border px-2 py-1 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer"
        >
          로그인
        </button>
      </form>
    </div>
  );
}
