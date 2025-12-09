"use client";

import { useEffect, useState } from "react";
import Link from "next/link"; // [변경] Link 컴포넌트 import

type Post = {
  id: string;
  title: string;
  createdAt: number;
  userName: string;
};

// [변경] Props(setSelectMenu 등) 제거 -> Page는 Props를 받지 않음
export default function TotalBoardPage() {
  // 각 섹션별 상태 관리
  const [dailyList, setDailyList] = useState<Post[]>([]);
  const [weeklyList, setWeeklyList] = useState<Post[]>([]);
  const [approvalList, setApprovalList] = useState<Post[]>([]);
  const [reportList, setReportList] = useState<Post[]>([]);
  const [noticeList, setNoticeList] = useState<Post[]>([]);
  const [resourceList, setResourceList] = useState<Post[]>([]);

  // 데이터 로드 함수
  const loadAllData = async () => {
    try {
      const results = await Promise.allSettled([
        fetch("/api/daily/list").then((res) => res.json()),
        fetch("/api/weekly/list").then((res) => res.json()),
        fetch("/api/approvals/list").then((res) => res.json()),
        fetch("/api/report/list").then((res) => res.json()),
        fetch("/api/notice/list").then((res) => res.json()),
        fetch("/api/resources/list").then((res) => res.json()),
      ]);

      if (results[0].status === "fulfilled")
        setDailyList(results[0].value || []);
      if (results[1].status === "fulfilled")
        setWeeklyList(results[1].value || []);
      if (results[2].status === "fulfilled")
        setApprovalList(results[2].value || []);
      if (results[3].status === "fulfilled")
        setReportList(results[3].value || []);
      if (results[4].status === "fulfilled")
        setNoticeList(results[4].value || []);
      if (results[5].status === "fulfilled")
        setResourceList(results[5].value || []);
    } catch (error) {
      console.error("데이터 로딩 중 오류 발생:", error);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
  };

  // [변경] 리스트 렌더링 헬퍼: basePath를 받아 Link href를 생성
  const RenderList = ({
    items,
    basePath, // 이동할 상세 페이지의 기본 경로 (예: /main/work/daily)
  }: {
    items: Post[];
    basePath: string;
  }) => {
    if (!items || items.length === 0) {
      return (
        <div className="py-4 text-center text-gray-400 text-sm">
          등록된 게시물이 없습니다.
        </div>
      );
    }

    return (
      <ul>
        {items.slice(0, 5).map((item) => (
          <li
            key={item.id}
            className="border-b hover:bg-gray-50 group transition-colors"
          >
            {/* [변경] onClick -> Link 사용 */}
            <Link
              href={`${basePath}/${item.id}`}
              className="py-2 flex justify-between items-center w-full h-full cursor-pointer"
            >
              <p className="hover:text-purple-400 transition-colors truncate max-w-[60%]">
                {item.title}
              </p>

              <div className="flex items-center gap-[15px] text-xs text-gray-500 flex-shrink-0">
                <span className="font-medium text-gray-500">
                  {item.userName}
                </span>
                <span>{formatDate(item.createdAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 p-6">
      {/* 1. 일일 업무 보고서 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">일일 업무 보고서</h3>
          {/* [변경] 더보기 버튼 -> Link */}
          <Link
            href="/main/work" // 업무보고 메인 페이지 경로
            className="text-sm text-blue-500 cursor-pointer hover:underline"
          >
            + 더보기
          </Link>
        </div>
        {/* [변경] basePath 전달: 클릭 시 /main/work/daily/{id} 로 이동 */}
        <RenderList items={dailyList} basePath="/main/work/daily" />
      </div>

      {/* 2. 주간 업무 보고서 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">주간 업무 보고서</h3>
          <Link
            href="/main/work" // (주간 탭이 기본이면 query string 등 활용 가능)
            className="text-sm text-blue-500 cursor-pointer hover:underline"
          >
            + 더보기
          </Link>
        </div>
        <RenderList items={weeklyList} basePath="/main/work/weekly" />
      </div>

      {/* 3. 품의서 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">품의서</h3>
          <Link
            href="/main/approvals" // 품의서 페이지 경로
            className="text-sm text-blue-500 cursor-pointer hover:underline"
          >
            + 더보기
          </Link>
        </div>
        <RenderList items={approvalList} basePath="/main/approvals" />
      </div>

      {/* 4. 보고서 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">보고서</h3>
          <Link
            href="/main/report" // 보고서 페이지 경로
            className="text-sm text-blue-500 cursor-pointer hover:underline"
          >
            + 더보기
          </Link>
        </div>
        <RenderList items={reportList} basePath="/main/report/posts" />
      </div>

      {/* 5. 공지사항 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">공지사항</h3>
          <Link
            href="/main/notice" // 공지사항 페이지 경로
            className="text-sm text-blue-500 cursor-pointer hover:underline"
          >
            + 더보기
          </Link>
        </div>
        <RenderList items={noticeList} basePath="/main/notice" />
      </div>

      {/* 6. 자료실 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">자료실</h3>
          <Link
            href="/main/resources" // 자료실 페이지 경로
            className="text-sm text-blue-500 cursor-pointer hover:underline"
          >
            + 더보기
          </Link>
        </div>
        <RenderList items={resourceList} basePath="/main/resources" />
      </div>
    </div>
  );
}
