"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useState } from "react";

// 타입 정의
interface DailyDetail {
  id: string;
  title: string;
  content: string;
  userName: string; // 작성자 이름
  createdAt: number;
  fileUrl?: string;
  fileName?: string;
}

interface CommentItem {
  id: string;
  userName: string;
  content: string;
  createdAt: number;
}

const fetchDailyDetail = async (id: string) => {
  const res = await fetch(`/api/daily/${id}`);
  if (!res.ok) throw new Error("Fetch failed");
  return res.json();
};

const fetchComments = async (dailyId: string, authorUserName: string) => {
  if (!authorUserName) return [];
  const res = await fetch("/api/daily/comment/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dailyId, authorUserName }),
  });
  const data = await res.json();
  return data.list || [];
};

export default function DailyDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { userName: myName, role } = useSelector(
    (state: RootState) => state.auth
  );
  const queryClient = useQueryClient();

  const [commentText, setCommentText] = useState("");

  // 1. 일일 업무 상세 조회
  const { data: daily, isLoading } = useQuery<DailyDetail>({
    queryKey: ["dailyDetail", id],
    queryFn: () => fetchDailyDetail(id),
    enabled: !!id,
  });

  // 2. 코멘트 목록 조회
  const { data: comments = [] } = useQuery<CommentItem[]>({
    queryKey: ["dailyComments", id],
    queryFn: () => fetchComments(id, daily!.userName),
    enabled: !!daily?.userName,
  });

  // 3. 코멘트 작성 Mutation
  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!daily) return;
      const res = await fetch("/api/daily/comment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyId: id,
          authorUserName: daily.userName,
          commenterName: myName,
          content: commentText,
        }),
      });
      if (!res.ok) throw new Error("댓글 작성 실패");
      return res.json();
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["dailyComments", id] });
    },
    onError: (err) => alert(err.message),
  });

  // 4. 코멘트 삭제 Mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!daily) return;
      const res = await fetch("/api/daily/comment/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyId: id,
          authorUserName: daily.userName, // 게시글 주인
          commentId: commentId,
          requestUserName: myName, // 삭제 요청자 (나)
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "삭제 실패");
      }
      return result;
    },
    onSuccess: () => {
      alert("댓글이 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["dailyComments", id] });
    },
    onError: (err) => alert(err.message),
  });

  // ✅ 5. [추가] 코멘트 수정 Mutation
  const updateCommentMutation = useMutation({
    mutationFn: async ({
      commentId,
      content,
    }: {
      commentId: string;
      content: string;
    }) => {
      if (!daily) return;
      const res = await fetch("/api/daily/comment/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyId: id,
          authorUserName: daily.userName, // 게시글 주인
          commentId: commentId,
          requestUserName: myName, // 수정 요청자 (나)
          content: content,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "수정 실패");
      }
      return result;
    },
    onSuccess: () => {
      alert("댓글이 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["dailyComments", id] });
    },
    onError: (err) => alert(err.message),
  });

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return alert("내용을 입력해주세요.");
    addCommentMutation.mutate();
  };

  const handleDeleteComment = (commentId: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const handleUpdateComment = (commentId: string, newContent: string) => {
    updateCommentMutation.mutate({ commentId, content: newContent });
  };

  if (isLoading) return <div className="p-8 text-center">로딩 중...</div>;
  if (!daily)
    return <div className="p-8 text-center">글을 찾을 수 없습니다.</div>;

  const isAuthorized =
    role === "supervisor" || role === "admin" || daily.userName === myName;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-6 bg-white border rounded-2xl shadow-sm mx-auto max-w-2xl mt-10 p-10">
        <div className="text-6xl">🚫</div>
        <h2 className="text-2xl font-bold text-gray-800">
          접근 권한이 없습니다
        </h2>
        <button
          onClick={() => router.back()}
          className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
        >
          뒤로가기
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 border rounded-xl bg-white shadow-sm max-w-4xl mx-auto mt-6 mb-20">
      {/* 상단 버튼 영역 */}
      <div className="flex justify-between items-center mb-4">
        <Link
          href="/main/work/daily"
          prefetch={false}
          className="px-3 py-1 border rounded-lg hover:bg-gray-100 text-sm"
        >
          ← 목록으로
        </Link>
        {myName === daily.userName && (
          <div className="flex gap-2">
            <Link
              href={`/main/work/daily/edit/${id}`}
              prefetch={false}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              수정
            </Link>
          </div>
        )}
      </div>

      <h2 className="text-3xl font-bold mb-4">{daily.title}</h2>

      <div className="flex items-center text-sm text-gray-500 mb-8 pb-4 border-b gap-4">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-gray-700">작성자:</span>
          <span className="text-gray-900">{daily.userName}</span>
        </div>
        <div className="w-[1px] h-3 bg-gray-300"></div>
        <div>{new Date(daily.createdAt).toLocaleString()}</div>
      </div>

      <div
        className="prose-editor max-w-none text-gray-800 leading-relaxed min-h-[200px]"
        dangerouslySetInnerHTML={{ __html: daily.content }}
      />

      {daily.fileUrl && (
        <div className="mt-10 pt-6 border-t">
          <p className="text-sm text-gray-600 mb-2 font-semibold">첨부파일</p>
          <a
            href={daily.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-blue-700 rounded-lg transition-colors no-underline"
          >
            <span className="truncate max-w-xs">
              {daily.fileName || "첨부파일 다운로드"}
            </span>
          </a>
        </div>
      )}

      {/* ✅ 코멘트 섹션 */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          💬 코멘트 ({comments.length})
        </h3>

        {/* 코멘트 목록 */}
        <ul className="space-y-4 mb-6">
          {comments.map((c) => (
            <CommentItemView
              key={c.id}
              comment={c}
              myName={myName || ""}
              onDelete={handleDeleteComment}
              onUpdate={handleUpdateComment}
            />
          ))}
          {comments.length === 0 && (
            <li className="text-sm text-gray-400 text-center py-4">
              등록된 코멘트가 없습니다.
            </li>
          )}
        </ul>

        {/* 코멘트 작성 폼 */}
        <form onSubmit={handleAddComment} className="flex flex-col gap-2">
          <textarea
            className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-[#51709e] outline-none resize-none text-sm"
            rows={3}
            placeholder="코멘트를 입력하세요..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addCommentMutation.isPending}
              className="px-4 py-2 bg-[#51709e] text-white rounded-lg text-sm font-bold hover:bg-[#405f8d] transition-colors disabled:bg-gray-300 cursor-pointer"
            >
              {addCommentMutation.isPending ? "등록 중..." : "등록하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ✅ [추가] 개별 댓글 컴포넌트 (수정 모드 관리용)
function CommentItemView({
  comment,
  myName,
  onDelete,
  onUpdate,
}: {
  comment: CommentItem;
  myName: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const handleUpdate = () => {
    if (!editContent.trim()) return alert("내용을 입력해주세요.");
    onUpdate(comment.id, editContent);
    setIsEditing(false);
  };

  return (
    <li className="bg-gray-50 p-4 rounded-lg group">
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col">
          <span className="font-bold text-gray-800 text-sm">
            {comment.userName}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(comment.createdAt).toLocaleString()}
          </span>
        </div>

        {/* 본인 댓글인 경우 수정/삭제 버튼 노출 */}
        {comment.userName === myName && !isEditing && (
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setIsEditing(true)}
              className="text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
            >
              수정
            </button>
            <button
              onClick={() => onDelete(comment.id)}
              className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              삭제
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            className="w-full border p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end gap-2 text-xs">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditContent(comment.content);
              }}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={handleUpdate}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">
          {comment.content}
        </p>
      )}
    </li>
  );
}
