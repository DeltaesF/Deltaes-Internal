"use client";

import { useEffect, useState } from "react";

interface Person {
  position: string;
  name: string;
  email: string;
  extension: string;
  mobile: string;
}

interface Department {
  department: string;
  children: Person[];
}

export default function Organization() {
  const [orgData, setOrgData] = useState<Department[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("api/org");
        if (!res.ok) throw new Error("API 요청 실패");
        const data: Department[] = await res.json();
        setOrgData(data);
      } catch (error) {
        console.error("API 불러오기 오류:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <table className="w-[90%] mx-auto mt-5 border-separate border-spacing-0 border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <th className="border-b border-gray-300 p-2.5 text-left text-sm">
            부서
          </th>
          <th className="border-b border-gray-300 p-2.5 text-left text-sm">
            직위
          </th>
          <th className="border-b border-gray-300 p-2.5 text-left text-sm">
            이름
          </th>
          <th className="border-b border-gray-300 p-2.5 text-left text-sm">
            이메일
          </th>
          <th className="border-b border-gray-300 p-2.5 text-left text-sm">
            내선번호
          </th>
          <th className="border-b border-gray-300 p-2.5 text-left text-sm">
            휴대폰
          </th>
        </tr>
      </thead>
      <tbody>
        {orgData.map((dept, deptIdx) =>
          dept.children.map((person, personIdx) => (
            <tr key={`${deptIdx}-${personIdx}`} className="hover:bg-gray-50">
              {personIdx === 0 ? (
                <td
                  className="border-b border-gray-300 p-2.5 text-sm font-semibold"
                  rowSpan={dept.children.length}
                >
                  {dept.department}
                </td>
              ) : null}
              <td className="border-b border-gray-300 p-2.5 text-sm">
                {person.position}
              </td>
              <td className="border-b border-gray-300 p-2.5 text-sm">
                {person.name}
              </td>
              <td className="border-b border-gray-300 p-2.5 text-sm">
                {person.email}
              </td>
              <td className="border-b border-gray-300 p-2.5 text-sm">
                {person.extension}
              </td>
              <td className="border-b border-gray-300 p-2.5 text-sm">
                {person.mobile}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
