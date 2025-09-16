"use client";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const temporary = () => {
    router.push("/main");
  };
  return (
    <div>
      <div>로그인 페이지 입니다.</div> <br />
      <button onClick={temporary} className="cursor-pointer border">
        임시 로그인 개인 대시보드 페이지 이동
      </button>
    </div>
  );
}
