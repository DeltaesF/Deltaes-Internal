"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import { loginUser } from "@/store/slices/authSlice";

// ✅ [설정] 회사의 이메일 도메인을 여기에 입력하세요
const COMPANY_DOMAIN = "@deltaes.co.kr";

export default function Login() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  // 리덕스 상태에서 로딩 상태 가져오기
  const { loading } = useSelector((state: RootState) => state.auth);

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");

  // 이미 로그인된 상태라면 대시보드로 이동
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

    // 아이디만 입력 시 도메인 자동 완성
    const emailToLogin = userId.includes("@")
      ? userId
      : userId + COMPANY_DOMAIN;

    try {
      // Redux Action 호출
      const resultAction = await dispatch(
        loginUser({ email: emailToLogin, password })
      );

      if (loginUser.fulfilled.match(resultAction)) {
        // 로그인 성공 시 이동
        router.replace("/main/dashboard/individual");
      } else {
        // 로그인 실패 시 에러 던짐
        throw new Error(resultAction.error.message);
      }
    } catch (err: unknown) {
      // ✅ [수정] any -> unknown으로 변경하여 ESLint 오류 해결
      let msg = "로그인에 실패했습니다.";

      // ✅ 에러가 Error 객체인지 확인 후 메시지 접근
      if (err instanceof Error) {
        if (
          err.message.includes("invalid-credential") ||
          err.message.includes("user-not-found") ||
          err.message.includes("wrong-password")
        ) {
          msg = "아이디 또는 비밀번호가 올바르지 않습니다.";
        }
      }
      alert(msg);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h2 className="text-3xl font-bold mb-4">Deltaes</h2>
      <form onSubmit={handleLogin} className="flex flex-col gap-2">
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
          disabled={loading} // 로딩 중 버튼 비활성화
          className={`px-4 py-2 text-white rounded font-bold mt-2 transition-colors ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 cursor-pointer"
          }`}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
