import { db } from "@/lib/firebaseAdmin";
import Link from "next/link";

async function getApprovals() {
  try {
    const snapshot = await db
      .collectionGroup("userApprovals")
      .orderBy("createdAt", "desc")
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
    console.error("Error fetching reports:", error);
    return [];
  }
}

export default async function ApprovalsPage() {
  const reports = await getApprovals();

  return (
    <div className="flex flex-col w-full">
      <div className="border rounded-2xl shadow-sm p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[20px] font-semibold">품의서</h3>
          <Link
            href="/main/workoutside/write"
            className="px-4 py-2 rounded-xl border border-[#519d9e] hover:bg-[#519d9e] hover:text-white cursor-pointer text-sm"
          >
            글작성 ✎
          </Link>
        </div>

        <ul>
          {reports.map((item) => (
            <li
              key={item.id}
              className="border-b flex justify-between items-center hover:bg-gray-50 group transition-colors"
            >
              <Link
                href={`/main/workoutside/approvals/${item.id}`}
                className="py-2 flex justify-between items-center w-full h-full px-2"
              >
                <p className="hover:text-purple-400 transition-colors truncate">
                  {item.title}
                </p>
                <div className="flex items-center gap-[15px] text-xs text-gray-500 flex-shrink-0">
                  <span className="font-medium text-gray-500">
                    {item.userName}
                  </span>
                  <span>
                    {new Date(item.createdAt).toLocaleDateString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </span>
                </div>
              </Link>
            </li>
          ))}
          {reports.length === 0 && (
            <li className="py-4 text-center text-gray-400">
              등록된 보고서가 없습니다.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
