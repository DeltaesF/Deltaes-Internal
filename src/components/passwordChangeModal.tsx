"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";

export default function PasswordChangeModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const user = auth.currentUser;

    if (!user || !user.email) {
      alert("로그인 정보가 없습니다.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("새 비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      alert("비밀번호는 6자 이상이어야 합니다.");
      setLoading(false);
      return;
    }

    try {
      // 1. 재인증 (보안 절차: 비밀번호 변경 전 현재 비밀번호 확인)
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // 2. 비밀번호 업데이트
      await updatePassword(user, newPassword);

      alert("비밀번호가 성공적으로 변경되었습니다.\n다시 로그인해주세요.");
      onClose();
      // 필요하다면 여기서 로그아웃 처리를 할 수도 있습니다.
      // await auth.signOut();
      // window.location.href = "/login";
    } catch (error: unknown) {
      console.error(error);

      if (error instanceof FirebaseError) {
        if (error.code === "auth/invalid-credential") {
          alert("현재 비밀번호가 올바르지 않습니다.");
        } else if (error.code === "auth/weak-password") {
          alert("비밀번호가 너무 약합니다. 더 복잡하게 설정해주세요.");
        } else if (error.code === "auth/requires-recent-login") {
          alert("보안을 위해 다시 로그인 후 시도해주세요.");
        } else {
          alert("비밀번호 변경 실패: " + error.message);
        }
      } else {
        alert("알 수 없는 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[9999]">
      <div className="bg-white p-6 rounded-xl shadow-lg w-[400px] relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-black cursor-pointer"
        >
          ✕
        </button>
        <h3 className="text-xl font-bold mb-4 text-center">비밀번호 변경</h3>

        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              현재 비밀번호
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border p-2 rounded focus:outline-none focus:border-[#519d9e]"
              placeholder="현재 비밀번호 입력"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              새 비밀번호
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border p-2 rounded focus:outline-none focus:border-[#519d9e]"
              placeholder="6자 이상 입력"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              새 비밀번호 확인
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border p-2 rounded focus:outline-none focus:border-[#519d9e]"
              placeholder="새 비밀번호 재입력"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`mt-2 py-2 rounded text-white font-bold transition-colors cursor-pointer ${
              loading ? "bg-gray-400" : "bg-[#519d9e] hover:bg-[#407f80]"
            }`}
          >
            {loading ? "변경 중..." : "변경하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
