"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react"; // ✅ useMemo 추가
import { useSelector } from "react-redux";
import { RootState } from "@/store";

// ✅ [1] 결재선 구조 공통 타입 정의
interface ApprovalLine {
  first: string[];
  second: string[];
  third: string[];
  shared: string[];
}

// ✅ [2] Recipients 인터페이스
interface Recipients {
  work: string[];
  report: ApprovalLine;
  approval: ApprovalLine;
  vacation: ApprovalLine;
}

// ✅ [3] DB 데이터 호환용 타입
interface DbRecipients {
  work?: string[];
  report?: string[] | Partial<ApprovalLine>;
  approval?: string[] | Partial<ApprovalLine>;
  vacation?: Partial<ApprovalLine>;
}

interface Employee {
  id: string;
  userName: string;
  email: string;
  department: string;
  role: string;
  order?: number; // ✅ 그룹핑 로직을 위해 필요
  recipients?: DbRecipients;
}

interface UpdateEmployeeData {
  id: string;
  role: string;
  department: string;
  recipients: Recipients;
}

type TabKey = "basic" | "work" | "report" | "approval" | "vacation";

const fetchEmployees = async () => {
  const res = await fetch("/api/supervisor/employees");
  if (!res.ok) throw new Error("Failed to fetch employees");
  return res.json();
};

export default function EmployeeManagementPage() {
  const { role } = useSelector((state: RootState) => state.auth);
  const queryClient = useQueryClient();

  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("basic");

  // 초기 상태 정의
  const emptyLine: ApprovalLine = {
    first: [],
    second: [],
    third: [],
    shared: [],
  };

  const [tempData, setTempData] = useState<{
    role: string;
    department: string;
    recipients: Recipients;
  }>({
    role: "",
    department: "",
    recipients: {
      work: [],
      report: { ...emptyLine },
      approval: { ...emptyLine },
      vacation: { ...emptyLine },
    },
  });

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: fetchEmployees,
    enabled: role === "admin",
    staleTime: 1000 * 60 * 10, // ✅ 10분 동안은 캐시된 데이터를 사용 (파이어베이스 읽기 방지)
  });

  // ✅ [RowSpan 계산 로직]
  // 같은 직급(order)이고 같은 부서(department)이면 부서 셀을 병합합니다.
  const processedEmployees = useMemo(() => {
    if (employees.length === 0) return [];

    // 각 행별로 부서 셀을 렌더링할지(count > 0), 숨길지(0) 결정하는 배열
    const spans = new Array(employees.length).fill(0);

    let currentSpanIdx = 0;
    spans[0] = 1;

    for (let i = 1; i < employees.length; i++) {
      const prev = employees[i - 1];
      const curr = employees[i];

      // 직급이 같고 부서가 같으면 병합
      const isSameOrder = (prev.order ?? 9999) === (curr.order ?? 9999);
      const isSameDept = prev.department === curr.department;

      if (isSameOrder && isSameDept) {
        spans[currentSpanIdx]++; // 대표 행의 span 증가
        spans[i] = 0; // 현재 행은 숨김
      } else {
        spans[i] = 1; // 새로운 그룹 시작
        currentSpanIdx = i;
      }
    }

    return employees.map((emp, i) => ({
      ...emp,
      deptRowSpan: spans[i], // 계산된 span 값 추가
    }));
  }, [employees]);

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateEmployeeData) => {
      const res = await fetch("/api/supervisor/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setIsModalOpen(false);
      alert("수정되었습니다.");
    },
    onError: () => alert("수정 실패"),
  });

  // 모달 열기 및 데이터 마이그레이션
  const openModal = (emp: Employee) => {
    setSelectedEmp(emp);

    const parseApprovalLine = (
      data: string[] | Partial<ApprovalLine> | undefined | null
    ): ApprovalLine => {
      if (Array.isArray(data)) {
        return { ...emptyLine, shared: data };
      }
      if (data && typeof data === "object") {
        return {
          first: data.first || [],
          second: data.second || [],
          third: data.third || [],
          shared: data.shared || [],
        };
      }
      return { ...emptyLine };
    };

    setTempData({
      role: emp.role || "user",
      department: emp.department || "development",
      recipients: {
        work: Array.isArray(emp.recipients?.work) ? emp.recipients!.work! : [],
        report: parseApprovalLine(emp.recipients?.report),
        approval: parseApprovalLine(emp.recipients?.approval),
        vacation: parseApprovalLine(emp.recipients?.vacation),
      },
    });
    setActiveTab("basic");
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!selectedEmp) return;
    updateMutation.mutate({
      id: selectedEmp.id,
      ...tempData,
    });
  };

  // 통합 토글 핸들러
  const toggleRecipient = (
    category: keyof Recipients,
    name: string,
    subCategory?: keyof ApprovalLine
  ) => {
    setTempData((prev) => {
      if (category === "work") {
        const currentList = prev.recipients.work || [];
        const newList = currentList.includes(name)
          ? currentList.filter((n) => n !== name)
          : [...currentList, name];
        return {
          ...prev,
          recipients: { ...prev.recipients, work: newList },
        };
      }

      if (subCategory) {
        const currentLine = prev.recipients[category] as ApprovalLine;
        const currentList = currentLine[subCategory] || [];
        let newList: string[] = [];

        if (["first", "second", "third"].includes(subCategory)) {
          newList = currentList.includes(name) ? [] : [name];
        } else {
          newList = currentList.includes(name)
            ? currentList.filter((n) => n !== name)
            : [...currentList, name];
        }

        return {
          ...prev,
          recipients: {
            ...prev.recipients,
            [category]: { ...currentLine, [subCategory]: newList },
          },
        };
      }
      return prev;
    });
  };

  // 렌더링 헬퍼 함수
  const renderApprovalSection = (
    category: "report" | "approval" | "vacation",
    title: string
  ) => {
    const data = tempData.recipients[category] as ApprovalLine;
    const colors = {
      first: "text-[#519d9e] accent-[#519d9e]",
      second: "text-red-500 accent-red-500",
      third: "text-orange-500 accent-orange-500",
      shared: "text-purple-600 accent-purple-600",
    };

    const renderGrid = (sub: keyof ApprovalLine, label: string) => (
      <div className="mb-4">
        <h4 className={`font-bold ${colors[sub].split(" ")[0]} mb-2 text-sm`}>
          {label}
        </h4>
        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border p-2 rounded bg-gray-50">
          {employees
            .filter((e) => e.id !== selectedEmp?.id)
            .map((target) => (
              <label
                key={`${category}-${sub}-${target.id}`}
                className="flex items-center gap-2 p-2 rounded hover:bg-gray-200 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className={`w-4 h-4 ${colors[sub].split(" ")[1]}`}
                  checked={data[sub]?.includes(target.userName) || false}
                  onChange={() =>
                    toggleRecipient(category, target.userName, sub)
                  }
                />
                <span className="text-sm">{target.userName}</span>
              </label>
            ))}
        </div>
      </div>
    );

    return (
      <div className="space-y-2">
        {renderGrid("first", "1. 1차 결재자 (1명 선택)")}
        {renderGrid("second", "2. 2차 결재자 (1명 선택)")}
        {renderGrid("third", "3. 3차 결재자 (1명 선택)")}
        {renderGrid("shared", "4. 공유/참조자 (다중 선택)")}
      </div>
    );
  };

  if (role !== "admin") {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-red-500 font-bold">🚫 접근 권한이 없습니다.</p>
      </div>
    );
  }

  if (isLoading) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="p-3 w-full">
      <h2 className="text-2xl font-bold mb-4">👥 직원 권한 및 결재선 관리</h2>

      <table className="w-full border-separate border-spacing-0 border-collapse bg-white shadow-sm rounded-lg overflow-hidden">
        <thead className="bg-gray-100">
          <tr>
            {/* p-3 -> py-2 px-3 으로 수정 */}
            <th className="border-b border-gray-300 py-2 px-3 text-left text-sm font-semibold w-32">
              부서
            </th>
            <th className="border-b border-gray-300 py-2 px-3 text-left text-sm font-semibold">
              이름
            </th>
            <th className="border-b border-gray-300 py-2 px-3 text-left text-sm font-semibold">
              권한
            </th>
            <th className="border-b border-gray-300 py-2 px-3 text-center text-sm font-semibold w-24">
              설정
            </th>
          </tr>
        </thead>
        <tbody>
          {processedEmployees.map((emp) => (
            <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
              {/* ✅ [RowSpan] 부서명이 같으면 하나로 통합 */}
              {emp.deptRowSpan > 0 && (
                <td
                  // p-3 -> py-1.5 px-3 (위아래 간격 축소)
                  className="border-b border-gray-300 py-2 px-3 text-sm font-bold bg-gray-50 align-middle border-r border-gray-200"
                  rowSpan={emp.deptRowSpan}
                >
                  {emp.department}
                </td>
              )}

              {/* p-3 -> py-2 px-3 */}
              <td className="border-b border-gray-300 py-2 px-3 text-sm font-medium">
                {emp.userName}
              </td>
              <td className="border-b border-gray-300 py-2 px-3 text-sm">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    emp.role === "supervisor"
                      ? "bg-purple-100 text-purple-700"
                      : emp.role === "admin"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {emp.role}
                </span>
              </td>
              <td className="border-b border-gray-300 py-2 px-3 text-center">
                <button
                  onClick={() => openModal(emp)}
                  // 버튼 패딩도 px-3 py-1.5 -> px-2 py-1 로 축소
                  className="px-2 py-1.25 border border-[#519d9e] text-[#519d9e] rounded hover:bg-[#519d9e] hover:text-white transition-colors text-xs font-medium cursor-pointer"
                >
                  관리
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && selectedEmp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white w-[600px] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-gray-100 p-3 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">
                ⚙️ {selectedEmp.userName} 설정
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex border-b bg-white gap-4 px-4 overflow-x-auto">
              {[
                { key: "basic", label: "기본 정보" },
                { key: "work", label: "업무보고" },
                { key: "report", label: "보고서" },
                { key: "approval", label: "품의서" },
                { key: "vacation", label: "휴가" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as TabKey)}
                  className={`flex-shrink-0 py-3 text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === tab.key
                      ? "border-b-2 border-[#519d9e] text-[#519d9e]"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* 1. 기본 정보 탭 */}
              {activeTab === "basic" && (
                <div className="flex flex-col gap-3">
                  <label className="block">
                    <span className="text-gray-700 font-semibold text-sm">
                      부서
                    </span>
                    <select
                      value={tempData.department}
                      onChange={(e) =>
                        setTempData({ ...tempData, department: e.target.value })
                      }
                      className="w-full mt-1.5 border p-2 rounded focus:ring-1 focus:ring-[#519d9e]"
                    >
                      <option value="development">기술연구소</option>
                      <option value="sales">기술영업팀</option>
                      <option value="marketing">마케팅팀</option>
                      <option value="Management">경영지원팀</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-gray-700 font-semibold text-sm">
                      권한 (Role)
                    </span>
                    <select
                      value={tempData.role}
                      onChange={(e) =>
                        setTempData({ ...tempData, role: e.target.value })
                      }
                      className="w-full mt-1.5 border p-2 rounded focus:ring-1 focus:ring-[#519d9e]"
                    >
                      <option value="user">User (일반)</option>
                      <option value="admin">Supervisor (팀장)</option>
                      <option value="supervisor">admin (관리자)</option>
                      <option value="ceo">CEO</option>
                    </select>
                  </label>
                </div>
              )}

              {/* 2. 업무보고 (단순 공유) */}
              {activeTab === "work" && (
                <div>
                  <p className="text-sm text-gray-500 mb-3">
                    <span className="font-bold text-[#519d9e]">
                      일일/주간 업무보고
                    </span>
                    를 공유받을 대상을 선택하세요.
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border p-2 rounded bg-gray-50">
                    {employees
                      .filter((e) => e.id !== selectedEmp.id)
                      .map((target) => (
                        <label
                          key={target.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                            tempData.recipients.work.includes(target.userName)
                              ? "bg-blue-100 border-blue-200"
                              : "hover:bg-gray-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-[#519d9e]"
                            checked={tempData.recipients.work.includes(
                              target.userName
                            )}
                            onChange={() =>
                              toggleRecipient("work", target.userName)
                            }
                          />
                          <span className="text-sm">{target.userName}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              {/* 3. 보고서, 품의서, 휴가 (복합 결재선) */}
              {activeTab === "report" &&
                renderApprovalSection("report", "보고서")}
              {activeTab === "approval" &&
                renderApprovalSection("approval", "품의서")}
              {activeTab === "vacation" &&
                renderApprovalSection("vacation", "휴가")}
            </div>

            <div className="p-3 border-t bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-2 rounded bg-gray-300 hover:bg-gray-400 text-sm font-medium transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 rounded bg-[#519d9e] text-white hover:bg-[#407f80] text-sm font-bold shadow-md transition-colors cursor-pointer"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
