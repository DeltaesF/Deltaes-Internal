import Pagination from "@/components/pagination";
import { db } from "@/lib/firebaseAdmin";
import Link from "next/link";

// 데이터 가져오기 (페이지네이션 적용)
async function getNotices(page: number, limit: number) {
  try {
    const offset = (page - 1) * limit;

    // 1. 전체 개수 구하기 (페이지네이션 계산용)
    const totalSnapshot = await db.collectionGroup("userNotices").count().get();
    const totalItems = totalSnapshot.data().count;

    // 2. 해당 페이지 데이터 가져오기
    const snapshot = await db
      .collectionGroup("userNotices")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .get();

    const data = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title || "제목 없음",
        userName: d.userName || "작성자 미상",
        createdAt:
          d.createdAt && typeof d.createdAt.toMillis === "function"
            ? d.createdAt.toMillis()
            : d.createdAt || Date.now(),
      };
    });

    return { data, totalItems };
  } catch (error) {
    console.error("Error fetching notices:", error);
    return { data: [], totalItems: 0 };
  }
}

export default async function NoticePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // URL에서 현재 페이지 번호 가져오기 (기본값 1)
  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const ITEMS_PER_PAGE = 15; // 15개씩 보여주기

  const { data: notices, totalItems } = await getNotices(
    currentPage,
    ITEMS_PER_PAGE
  );

  return (
    <div className="flex flex-col w-full p-6">
      <div className="border rounded-2xl shadow-sm p-6 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xl font-semibold">공지사항</h3>
          <Link
            href="/main/notice/write"
            prefetch={false}
            className="px-4 py-2 rounded-xl border border-[#bd4747] hover:bg-[#bd4747] hover:text-white cursor-pointer text-sm transition-colors"
          >
            글작성 ✎
          </Link>
        </div>

        <ul>
          {notices.map((item) => (
            <li
              key={item.id}
              className="border-b border-gray-400  group hover:bg-gray-50 transition-colors"
            >
              <Link
                href={`/main/notice/${item.id}`}
                prefetch={false}
                className="flex justify-between items-center w-full py-1"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <span className="text-[#bd4747] font-bold whitespace-nowrap">
                    [공지]
                  </span>
                  <p className="text-ms text-gray-800 truncate group-hover:text-[#bd4747] transition-colors">
                    {item.title}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 flex-shrink-0">
                  <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                    {item.userName}
                  </span>
                  <span>
                    {new Date(item.createdAt).toLocaleDateString("ko-KR", {
                      year: "2-digit",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </span>
                </div>
              </Link>
            </li>
          ))}
          {notices.length === 0 && (
            <li className="py-4 text-center text-gray-400">
              등록된 공지사항이 없습니다.
            </li>
          )}
        </ul>

        <Pagination
          totalItems={totalItems}
          itemsPerPage={ITEMS_PER_PAGE}
          currentPage={currentPage}
        />
      </div>
    </div>
  );
}
