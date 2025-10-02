"use client";
import { login } from "@/lib/auth";
import { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const temporary = () => {
    router.push("/main");
  };

  const handleEmailLogin = async () => {
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
      <h2 className="text-xl font-bold mb-4">Login</h2>
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
      <div className="flex gap-2">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer"
          onClick={handleEmailLogin}
        >
          로그인
        </button>
      </div>
      <div>
        <div>로그인 페이지 입니다.</div> <br />
        <button onClick={temporary} className="cursor-pointer border">
          임시 로그인 개인 대시보드 페이지 이동
        </button>
      </div>
    </div>
  );
}
