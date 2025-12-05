"use client";

import { useEffect, useState } from "react";

// 공통으로 사용할 데이터 타입 정의
type Post = {
  id: string;
  title: string;
  createdAt: number;
  userName: string;
};

export default function Total({
  setSelectMenu,
  setWorkDefaultTab,
}: {
  setSelectMenu: (menu: string) => void;
  setWorkDefaultTab: (tab: "daily" | "weekly") => void;
}) {
  // 각 섹션별 상태 관리
  const [dailyList, setDailyList] = useState<Post[]>([]);
  const [weeklyList, setWeeklyList] = useState<Post[]>([]);
  const [approvalList, setApprovalList] = useState<Post[]>([]); // 품의서
  const [reportList, setReportList] = useState<Post[]>([]); // 보고서
  const [noticeList, setNoticeList] = useState<Post[]>([]); // 공지사항
  const [resourceList, setResourceList] = useState<Post[]>([]); // 자료실

  // 데이터 로드 함수 (API 주소는 실제 백엔드 설정에 맞게 수정 필요)
  const loadAllData = async () => {
    try {
      // Promise.allSettled를 사용하여 하나가 실패해도 나머지는 로드되도록 처리
      const results = await Promise.allSettled([
        fetch("/api/daily/list").then((res) => res.json()), // 일일
        fetch("/api/weekly/list").then((res) => res.json()), // 주간
        fetch("/api/approvals/list").then((res) => res.json()), // 품의서 (가정)
        fetch("/api/report/list").then((res) => res.json()), // 보고서
        fetch("/api/notice/list").then((res) => res.json()), // 공지사항 (가정)
        fetch("/api/resources/list").then((res) => res.json()), // 자료실 (가정)
      ]);

      // 결과 할당
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

  // 날짜 포맷팅 헬퍼
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
  };

  // 리스트 렌더링 헬퍼 컴포넌트 (중복 코드 제거)
  const RenderList = ({
    items,
    onItemClick,
  }: {
    items: Post[];
    onItemClick: () => void;
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
            className="py-2 border-b flex justify-between items-center cursor-pointer hover:bg-gray-50 group"
            onClick={onItemClick}
          >
            <p className="hover:text-purple-400 transition-colors truncate">
              {item.title}
            </p>

            <div className="flex items-center gap-[15px] text-xs text-gray-500 flex-shrink-0">
              <span className="font-medium text-gray-500">{item.userName}</span>
              <span>{formatDate(item.createdAt)}</span>
            </div>
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
          <span
            className="text-sm text-blue-500 cursor-pointer hover:underline"
            onClick={() => {
              setSelectMenu("업무보고");
              setWorkDefaultTab("daily");
            }}
          >
            + 더보기
          </span>
        </div>
        <RenderList
          items={dailyList}
          onItemClick={() => {
            setSelectMenu("업무보고");
            setWorkDefaultTab("daily");
          }}
        />
      </div>

      {/* 2. 주간 업무 보고서 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">주간 업무 보고서</h3>
          <span
            className="text-sm text-blue-500 cursor-pointer hover:underline"
            onClick={() => {
              setSelectMenu("업무보고");
              setWorkDefaultTab("weekly");
            }}
          >
            + 더보기
          </span>
        </div>
        <RenderList
          items={weeklyList}
          onItemClick={() => {
            setSelectMenu("업무보고");
            setWorkDefaultTab("weekly");
          }}
        />
      </div>

      {/* 3. 품의서 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">품의서</h3>
          <span
            className="text-sm text-blue-500 cursor-pointer hover:underline"
            onClick={() => setSelectMenu("품의서")}
          >
            + 더보기
          </span>
        </div>
        <RenderList
          items={approvalList}
          onItemClick={() => setSelectMenu("품의서")}
        />
      </div>

      {/* 4. 보고서 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">보고서</h3>
          <span
            className="text-sm text-blue-500 cursor-pointer hover:underline"
            onClick={() => setSelectMenu("보고서")}
          >
            + 더보기
          </span>
        </div>
        <RenderList
          items={reportList}
          onItemClick={() => setSelectMenu("보고서")}
        />
      </div>

      {/* 5. 공지사항 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">공지사항</h3>
          <span
            className="text-sm text-blue-500 cursor-pointer hover:underline"
            onClick={() => setSelectMenu("공지사항")}
          >
            + 더보기
          </span>
        </div>
        <RenderList
          items={noticeList}
          onItemClick={() => setSelectMenu("공지사항")}
        />
      </div>

      {/* 6. 자료실 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">자료실</h3>
          <span
            className="text-sm text-blue-500 cursor-pointer hover:underline"
            onClick={() => setSelectMenu("자료실")}
          >
            + 더보기
          </span>
        </div>
        <RenderList
          items={resourceList}
          onItemClick={() => setSelectMenu("자료실")}
        />
      </div>
    </div>
  );
}
