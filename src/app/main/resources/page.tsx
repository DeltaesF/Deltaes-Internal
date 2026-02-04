import { db } from "@/lib/firebaseAdmin";
import Link from "next/link";

async function getResources() {
  try {
    const snapshot = await db
      .collectionGroup("userResources")
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
    console.error("Error fetching resources:", error);
    return [];
  }
}

export default async function ResourcesPage() {
  const resources = await getResources();

  return (
    <div className="flex flex-col w-full p-6">
      <div className="border rounded-2xl shadow-sm p-6 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xl font-semibold">자료실</h3>
          <Link
            href="/main/resources/write"
            prefetch={false}
            className="px-4 py-2 rounded-xl border border-[#bdbb47] hover:bg-[#bdab47] hover:text-white cursor-pointer text-sm transition-colors"
          >
            글작성 ✎
          </Link>
        </div>

        <ul>
          {resources.map((item) => (
            <li
              key={item.id}
              className="border-b border-gray-400  group hover:bg-gray-50 transition-colors"
            >
              <Link
                href={`/main/resources/${item.id}`}
                prefetch={false}
                className="flex justify-between items-center w-full py-1"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <span className="text-[#bdab47] font-bold whitespace-nowrap">
                    [자료]
                  </span>
                  <p className="text-ms text-gray-800 truncate group-hover:text-[#bdbb47] transition-colors">
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
          {resources.length === 0 && (
            <li className="py-4 text-center text-gray-400">
              등록된 자료가 없습니다.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
