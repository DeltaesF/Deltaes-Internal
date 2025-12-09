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
    <div className="w-full p-6">
      <table className="w-[90%] mx-auto border-separate border-spacing-0 border-collapse bg-white shadow-sm rounded-lg overflow-hidden">
        <thead className="bg-gray-100">
          <tr>
            <th className="border-b border-gray-300 p-3 text-left text-sm font-semibold">
              부서
            </th>
            <th className="border-b border-gray-300 p-3 text-left text-sm font-semibold">
              직위
            </th>
            <th className="border-b border-gray-300 p-3 text-left text-sm font-semibold">
              이름
            </th>
            <th className="border-b border-gray-300 p-3 text-left text-sm font-semibold">
              이메일
            </th>
            <th className="border-b border-gray-300 p-3 text-left text-sm font-semibold">
              내선번호
            </th>
            <th className="border-b border-gray-300 p-3 text-left text-sm font-semibold">
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
                    className="border-b border-gray-300 p-3 text-sm font-bold bg-gray-50 align-middle"
                    rowSpan={dept.children.length}
                  >
                    {dept.department}
                  </td>
                )}
                <td className="border-b border-gray-300 p-3 text-sm">
                  {person.position}
                </td>
                <td className="border-b border-gray-300 p-3 text-sm">
                  {person.name}
                </td>
                <td className="border-b border-gray-300 p-3 text-sm text-gray-600">
                  {person.email}
                </td>
                <td className="border-b border-gray-300 p-3 text-sm">
                  {person.extension}
                </td>
                <td className="border-b border-gray-300 p-3 text-sm">
                  {person.mobile}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
