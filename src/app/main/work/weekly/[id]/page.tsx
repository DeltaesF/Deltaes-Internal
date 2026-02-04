"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

// ✅ 타입 정의
interface WeeklyReport {
  id: string;
  title: string;
  content: string;
  userName: string;
  createdAt: number;
  fileUrl?: string | null;
  fileName?: string | null;
}

interface DailyReport {
  id: string;
  title: string;
  content: string;
  userName: string;
  createdAt: number;
  fileUrl?: string | null;
  fileName?: string | null;
}

interface CommentItem {
  id: string;
  userName: string;
  content: string;
  createdAt: number;
}

// ✅ API Fetcher 함수들

// 1. 주간 보고서 상세 조회
const fetchWeeklyDetail = async (id: string) => {
  const res = await fetch(`/api/weekly/${id}`);
  if (!res.ok) throw new Error("Weekly fetch failed");
  return res.json();
};

// 2. 관련 일일 보고서 리스트 조회
const fetchDailyList = async (
  userName: string,
  role: string,
  startDate: number,
  endDate: number
) => {
  const res = await fetch("/api/daily/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName,
      role,
      startDate,
      endDate,
      limit: 7,
    }),
  });
  if (!res.ok) throw new Error("Daily fetch failed");

  const data = await res.json();
  return data.list || [];
};

// 3. 코멘트 목록 조회
const fetchComments = async (weeklyId: string, authorUserName: string) => {
  if (!authorUserName) return [];
  const res = await fetch("/api/weekly/comment/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weeklyId, authorUserName }),
  });
  const data = await res.json();
  return data.list || [];
};

// -----------------------------------------------------------------------
// [1] 메인 페이지 컴포넌트
// -----------------------------------------------------------------------
export default function WeeklyDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { userName: myName, role } = useSelector(
    (state: RootState) => state.auth || { userName: "", role: "" }
  );

  const { data: weekly, isLoading: isWeeklyLoading } = useQuery<WeeklyReport>({
    queryKey: ["weeklyDetail", id],
    queryFn: () => fetchWeeklyDetail(id),
    enabled: !!id,
  });

  if (isWeeklyLoading)
    return (
      <div className="p-10 text-center text-xl">보고서 불러오는 중...</div>
    );
  if (!weekly)
    return (
      <div className="p-10 text-center text-xl">보고서를 찾을 수 없습니다.</div>
    );

  const isAuthorized =
    role === "supervisor" || role === "admin" || weekly.userName === myName;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-6 bg-white border rounded-2xl shadow-sm mx-auto max-w-2xl mt-10 p-10">
        <div className="text-7xl">🚫</div>
        <h2 className="text-3xl font-bold text-gray-800">
          접근 권한이 없습니다
        </h2>
        <button
          onClick={() => router.back()}
          className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-bold text-lg"
        >
          뒤로가기
        </button>
      </div>
    );
  }

  return <AuthorizedContent weekly={weekly} myName={myName!} role={role!} />;
}

// -----------------------------------------------------------------------
// [2] 권한 확인된 콘텐츠 컴포넌트
// -----------------------------------------------------------------------
function AuthorizedContent({
  weekly,
  myName,
  role,
}: {
  weekly: WeeklyReport;
  myName: string;
  role: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");

  // 날짜 계산 로직
  const weeklyDate = new Date(weekly.createdAt);
  const dayOfWeek = weeklyDate.getDay();

  const targetDate = new Date(weeklyDate);
  if (dayOfWeek <= 2) {
    targetDate.setDate(targetDate.getDate() - 7);
  }

  const targetDay = targetDate.getDay();
  const diffToMon =
    targetDate.getDate() - targetDay + (targetDay === 0 ? -6 : 1);
  const monday = new Date(targetDate);
  monday.setDate(diffToMon);
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);

  // 1. 일일 업무 데이터 조회
  const { data: dailyList = [], isLoading: isDailyLoading } = useQuery<
    DailyReport[]
  >({
    queryKey: ["dailyListForMeeting", weekly.userName, monday.getTime()],
    queryFn: async () => {
      const data = await fetchDailyList(
        weekly.userName,
        role,
        monday.getTime(),
        friday.getTime()
      );
      return data;
    },
  });

  const relatedDailys = dailyList.sort((a, b) => a.createdAt - b.createdAt);

  // 2. 코멘트 데이터 조회
  const { data: comments = [] } = useQuery<CommentItem[]>({
    queryKey: ["weeklyComments", weekly.id],
    queryFn: () => fetchComments(weekly.id, weekly.userName),
    enabled: !!weekly.userName,
  });

  // 3. 코멘트 작성
  const addCommentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/weekly/comment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeklyId: weekly.id,
          authorUserName: weekly.userName,
          commenterName: myName,
          content: commentText,
        }),
      });
      if (!res.ok) throw new Error("작성 실패");
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({
        queryKey: ["weeklyComments", weekly.id],
      });
    },
    onError: (err) => alert(err.message),
  });

  // 4. 코멘트 삭제
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch("/api/weekly/comment/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeklyId: weekly.id,
          authorUserName: weekly.userName,
          commentId,
          requestUserName: myName,
        }),
      });
      if (!res.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => {
      alert("삭제되었습니다.");
      queryClient.invalidateQueries({
        queryKey: ["weeklyComments", weekly.id],
      });
    },
  });

  // 5. 코멘트 수정
  const updateCommentMutation = useMutation({
    mutationFn: async ({
      commentId,
      content,
    }: {
      commentId: string;
      content: string;
    }) => {
      const res = await fetch("/api/weekly/comment/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeklyId: weekly.id,
          authorUserName: weekly.userName,
          commentId,
          requestUserName: myName,
          content,
        }),
      });
      if (!res.ok) throw new Error("수정 실패");
    },
    onSuccess: () => {
      alert("수정되었습니다.");
      queryClient.invalidateQueries({
        queryKey: ["weeklyComments", weekly.id],
      });
    },
  });

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return alert("내용을 입력하세요.");
    addCommentMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-6 p-4 max-w-[80%] mx-auto pb-20">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 bg-white border rounded-lg hover:bg-gray-50 text-base font-medium transition-colors cursor-pointer"
        >
          ◀ 목록으로 돌아가기
        </button>
        <div className="text-lg text-gray-600 font-medium">
          작성일: {new Date(weekly.createdAt).toLocaleString()}
        </div>
      </div>

      <section className="bg-white border-2 border-[#519d9e] rounded-2xl shadow-lg overflow-hidden">
        {/* 주간 보고서 헤더 */}
        <div className="bg-[#519d9e] px-8 py-5 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              {weekly.title}
            </h2>
          </div>
        </div>

        {/* 관련 일일 업무 섹션 */}
        <div className="flex items-center gap-4 mt-6 px-8">
          <div className="h-[2px] flex-1 bg-gray-300"></div>
          <span className="text-gray-700 text-xl font-bold">
            전주 일일 업무 내역
          </span>
          <div className="h-[2px] flex-1 bg-gray-300"></div>
        </div>

        <section className="flex flex-col gap-6 p-8">
          {isDailyLoading ? (
            <p className="text-center text-gray-400 py-10 text-xl">
              일일 업무 내역 로딩 중...
            </p>
          ) : relatedDailys.length > 0 ? (
            relatedDailys.map((daily) => (
              <div
                key={daily.id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center rounded-t-xl">
                  <div className="flex items-center gap-4">
                    <span className="bg-gray-200 text-gray-800 text-base font-bold px-3 py-1.5 rounded">
                      {
                        ["일", "월", "화", "수", "목", "금", "토"][
                          new Date(daily.createdAt).getDay()
                        ]
                      }
                      요일
                    </span>
                    <h3 className="text-xl font-bold text-gray-800">
                      {daily.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-base text-gray-600">
                      {new Date(daily.createdAt).toLocaleDateString()}
                    </span>
                    {daily.userName === myName && (
                      <Link
                        href={`/main/work/daily/edit/${daily.id}`}
                        prefetch={false}
                        className="text-sm px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700 transition-colors"
                      >
                        수정
                      </Link>
                    )}
                  </div>
                </div>

                <div className="p-8">
                  <div
                    className="prose-editor text-lg text-gray-800 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: daily.content }}
                  />
                  {daily.fileUrl && (
                    <div className="mt-6 pt-4 border-t border-dashed border-gray-200">
                      <a
                        href={daily.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-base text-blue-700 hover:underline bg-blue-50 px-3 py-2 rounded font-medium"
                      >
                        📎 {daily.fileName || "첨부파일 다운로드"}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500 text-lg">
              해당 주간에 작성된 일일 업무 보고가 없습니다.
            </div>
          )}
        </section>

        {/* 금주 업무 보고 섹션 */}
        <div className="bg-[#519d9e] px-8 py-5 flex justify-between items-center mt-4">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              금주 업무 보고
              <span className="text-lg font-normal opacity-90 bg-white/20 px-3 py-1 rounded">
                {weekly.userName}
              </span>
            </h2>
          </div>
          {weekly.userName === myName && (
            <Link
              href={`/main/work/weekly/edit/${weekly.id}`}
              prefetch={false}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-base font-medium border border-white/30 transition-colors"
            >
              수정하기
            </Link>
          )}
        </div>

        <div className="p-10">
          <div
            className="prose-editor max-w-none text-xl text-gray-900 leading-loose"
            dangerouslySetInnerHTML={{ __html: weekly.content }}
          />
          {weekly.fileUrl && (
            <div className="mt-10 pt-6 border-t">
              <p className="text-base text-gray-600 font-bold mb-2">첨부파일</p>
              <a
                href={weekly.fileUrl}
                target="_blank"
                className="text-blue-700 hover:underline text-lg flex items-center gap-2 font-medium"
              >
                📎 {weekly.fileName || "다운로드"}
              </a>
            </div>
          )}

          {/* ✅ 코멘트 섹션 */}
          <div className="mt-16 pt-10 border-t border-gray-200">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              💬 코멘트 ({comments.length})
            </h3>

            <ul className="space-y-6 mb-8">
              {comments.map((c) => (
                <CommentItemView
                  key={c.id}
                  comment={c}
                  myName={myName}
                  // ✅ [수정] 타입 명시로 Implicit any 오류 해결
                  onDelete={(id: string) => {
                    if (confirm("삭제하시겠습니까?"))
                      deleteCommentMutation.mutate(id);
                  }}
                  onUpdate={(id: string, txt: string) =>
                    updateCommentMutation.mutate({
                      commentId: id,
                      content: txt,
                    })
                  }
                />
              ))}
              {comments.length === 0 && (
                <li className="text-lg text-gray-400 text-center py-6">
                  등록된 코멘트가 없습니다.
                </li>
              )}
            </ul>

            <form onSubmit={handleAddComment} className="flex flex-col gap-4">
              <textarea
                className="w-full border p-4 rounded-xl focus:ring-2 focus:ring-[#519d9e] outline-none resize-none text-lg"
                rows={3}
                placeholder="코멘트를 입력하세요..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addCommentMutation.isPending}
                  className="px-6 py-3 bg-[#519d9e] text-white rounded-xl text-lg font-bold hover:bg-[#407f80] transition-colors cursor-pointer disabled:bg-gray-400"
                >
                  {addCommentMutation.isPending ? "등록 중..." : "등록하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

// ✅ [3] 코멘트 아이템 컴포넌트 (타입 명시)
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
  const [text, setText] = useState(comment.content);

  return (
    <li className="bg-gray-50 p-6 rounded-xl group border border-gray-100">
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col">
          <span className="font-bold text-gray-800 text-lg">
            {comment.userName}
          </span>
          <span className="text-sm text-gray-500">
            {new Date(comment.createdAt).toLocaleString()}
          </span>
        </div>
        {comment.userName === myName && !isEditing && (
          <div className="flex gap-3 text-sm">
            <button
              onClick={() => setIsEditing(true)}
              className="text-gray-500 hover:text-blue-600 transition-colors"
            >
              수정
            </button>
            <button
              onClick={() => onDelete(comment.id)}
              className="text-gray-500 hover:text-red-600 transition-colors"
            >
              삭제
            </button>
          </div>
        )}
      </div>
      {isEditing ? (
        <div className="flex flex-col gap-3">
          <textarea
            className="w-full border p-3 rounded-lg text-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-3 text-sm">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => {
                onUpdate(comment.id, text);
                setIsEditing(false);
              }}
              className="px-4 py-2 bg-[#519d9e] text-white rounded-lg hover:bg-[#407f80] transition-colors"
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <p className="text-lg text-gray-800 whitespace-pre-wrap leading-relaxed">
          {comment.content}
        </p>
      )}
    </li>
  );
}
