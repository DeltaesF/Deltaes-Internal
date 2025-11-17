"use client";
import { login } from "@/lib/auth";
import { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleEmailLogin = async (e?: React.FormEvent) => {
    e?.preventDefault(); // form 기본 제출 동작 방지
    try {
      await login(email, password);
      alert("로그인 성공!");
      router.push("/main");
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
