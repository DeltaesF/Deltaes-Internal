import { db } from "@/lib/firebaseAdmin";
import Link from "next/link";

interface Post {
  id: string;
  title: string;
  userName: string;
  createdAt: number;
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  });
};

// DB에서 데이터 가져오는 함수 (최신순 5개 제한)
async function getLatestData(collectionName: string): Promise<Post[]> {
  try {
    const snapshot = await db
      .collectionGroup(collectionName)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || "제목 없음",
        userName: data.userName || "작성자 미상",
        createdAt:
          data.createdAt && typeof data.createdAt.toMillis === "function"
            ? data.createdAt.toMillis()
            : data.createdAt || Date.now(),
      };
    });
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return [];
  }
}

export default async function TotalBoardPage() {
  const [
    dailyList,
    weeklyList,
    approvalList,
    reportList,
    noticeList,
    resourceList,
  ] = await Promise.all([
    getLatestData("userDailys"),
    getLatestData("userWeeklys"),
    getLatestData("userApprovals"),
    getLatestData("userReports"),
    getLatestData("userNotices"),
    getLatestData("userResources"),
  ]);

  const RenderList = ({
    items,
    basePath,
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
        {items.map((item) => (
          <li
            key={item.id}
            className="border-b hover:bg-gray-50 group transition-colors"
          >
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
          <Link
            href="/main/work/daily"
            className="text-sm text-blue-500 cursor-pointer hover:underline"
          >
            + 더보기
          </Link>
        </div>
        <RenderList items={dailyList} basePath="/main/work/daily" />
      </div>

      {/* 2. 주간 업무 보고서 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">주간 업무 보고서</h3>
          <Link
            href="/main/work/weekly"
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
            href="/main/workoutside/approvals"
            className="text-sm text-blue-500 cursor-pointer hover:underline"
          >
            + 더보기
          </Link>
        </div>
        <RenderList
          items={approvalList}
          basePath="/main/workoutside/approvals"
        />
      </div>

      {/* 4. 보고서 */}
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">보고서</h3>
          <Link
            href="/main/report/posts"
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
            href="/main/notice"
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
            href="/main/resources"
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
