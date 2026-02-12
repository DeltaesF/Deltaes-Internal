import { db } from "@/lib/firebaseAdmin";

interface Person {
  position: string;
  name: string;
  email: string;
  extension: string;
  mobile: string;
}

interface Department {
  id: string;
  department: string;
  children: Person[];
}

async function getOrgData() {
  try {
    const snapshot = await db
      .collection("orgData")
      .orderBy("order", "asc")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Department, "id">),
    }));
  } catch (error) {
    console.error("Error fetching org data:", error);
    return [];
  }
}

export default async function OrganizationPage() {
  const orgData = await getOrgData();

  return (
    <div className="w-full p-4 md:p-6 min-w-0">
      {/* [반응형 핵심] 
        1. overflow-x-auto: 화면이 좁아지면 가로 스크롤 생성
        2. shadow-sm rounded-lg: 기존 테이블의 스타일을 감싸는 컨테이너로 이동하여 깔끔하게 표시
    */}
      {/* 모바일 유저를 위한 안내 가이드 (선택 사항) */}
      <p className="block md:hidden  text-xs text-gray-400 ml-15">
        ← 가로로 스크롤하여 상세 내용을 확인하세요 →
      </p>
      <div className="w-full md:w-[95%] lg:w-[90%] mx-auto bg-white shadow-sm rounded-lg overflow-x-auto custom-scrollbar">
        <table className="w-full border-separate border-spacing-0 border-collapse min-w-[800px]">
          {/* min-w-[800px]: 모바일에서도 테이블 형태가 뭉개지지 않도록 최소 너비 보장 */}
          <thead className="bg-gray-100">
            <tr>
              <th className="border-b border-gray-300 p-3 text-left text-sm font-semibold whitespace-nowrap">
                부서
              </th>
              <th className="border-b border-gray-300 p-3 text-left text-sm font-semibold whitespace-nowrap">
                직위
              </th>
              <th className="border-b border-gray-300 p-3 text-left text-sm font-semibold whitespace-nowrap">
                이름
              </th>
              <th className="border-b border-gray-300 p-3 text-left text-sm font-semibold whitespace-nowrap">
                이메일
              </th>
              <th className="border-b border-gray-300 p-3 text-left text-sm font-semibold whitespace-nowrap">
                내선번호
              </th>
              <th className="border-b border-gray-300 p-3 text-left text-sm font-semibold whitespace-nowrap">
                휴대폰
              </th>
            </tr>
          </thead>
          <tbody>
            {orgData.map((dept, deptIdx) =>
              dept.children.map((person, personIdx) => (
                <tr
                  key={`${deptIdx}-${personIdx}`}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {personIdx === 0 && (
                    <td
                      className="border-b border-gray-300 p-3 text-sm font-bold bg-gray-50 align-middle whitespace-nowrap"
                      rowSpan={dept.children.length}
                    >
                      {dept.department}
                    </td>
                  )}
                  <td className="border-b border-gray-300 p-3 text-sm whitespace-nowrap">
                    {person.position}
                  </td>
                  <td className="border-b border-gray-300 p-3 text-sm whitespace-nowrap">
                    {person.name}
                  </td>
                  <td className="border-b border-gray-300 p-3 text-sm text-gray-600 whitespace-nowrap">
                    {person.email}
                  </td>
                  <td className="border-b border-gray-300 p-3 text-sm whitespace-nowrap">
                    {person.extension}
                  </td>
                  <td className="border-b border-gray-300 p-3 text-sm whitespace-nowrap">
                    {person.mobile}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
