"use client";

import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

interface Props {
  authorName: string;
  editPath: string; // 예: /main/work/daily/edit/123
}

export default function EditActions({ authorName, editPath }: Props) {
  const { userName } = useSelector((state: RootState) => state.auth);

  // 로그인하지 않았거나, 작성자가 다르면 버튼 숨김
  if (!userName || userName !== authorName) return null;

  return (
    <div className="flex gap-2">
      <Link
        href={editPath}
        prefetch={false}
        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
      >
        수정
      </Link>
      {/* 필요하다면 여기에 삭제 버튼 추가 가능 */}
    </div>
  );
}
