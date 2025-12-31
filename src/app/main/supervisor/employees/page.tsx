"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

// ✅ [수정] Recipients 인터페이스 확장
interface Recipients {
  work: string[];
  report: string[];
  approval: string[];
  vacation?: {
    first: string[]; // 1차 (다중)
    second: string[]; // 2차 (단일)
    shared: string[]; // 공유 (다중)
  };
}

interface Employee {
  id: string;
  userName: string;
  email: string;
  department: string;
  role: string;
  recipients?: Recipients;
}

interface UpdateEmployeeData {
  id: string;
  role: string;
  department: string;
  recipients: Recipients;
}

// ✅ [수정] 탭 키에 vacation 추가
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

  // ✅ [수정] 초기값에 vacation 추가
  const [tempData, setTempData] = useState<{
    role: string;
    department: string;
    recipients: Recipients;
  }>({
    role: "",
    department: "",
    recipients: {
      work: [],
      report: [],
      approval: [],
      vacation: { first: [], second: [], shared: [] },
    },
  });

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: fetchEmployees,
    enabled: role === "supervisor",
  });

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

  const openModal = (emp: Employee) => {
    setSelectedEmp(emp);
    setTempData({
      role: emp.role || "user",
      department: emp.department || "development",
      recipients: {
        work: emp.recipients?.work || [],
        report: emp.recipients?.report || [],
        approval: emp.recipients?.approval || [],
        // ✅ vacation 데이터가 없으면 빈 배열로 초기화
        vacation: emp.recipients?.vacation || {
          first: [],
          second: [],
          shared: [],
        },
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

  // ✅ [수정] 통합 토글 핸들러 (휴가 로직 포함)
  const toggleRecipient = (
    category: string,
    name: string,
    subCategory?: "first" | "second" | "shared"
  ) => {
    setTempData((prev) => {
      // 1. 휴가 결재 라인 처리
      if (category === "vacation" && subCategory) {
        const currentVacation = prev.recipients.vacation || {
          first: [],
          second: [],
          shared: [],
        };
        const currentList = currentVacation[subCategory] || [];
        let newList: string[] = [];

        if (subCategory === "second") {
          // 2차 결재자는 단일 선택 (이미 선택된 사람이면 해제, 아니면 교체)
          newList = currentList.includes(name) ? [] : [name];
        } else {
          // 1차 및 공유자는 다중 선택 가능
          newList = currentList.includes(name)
            ? currentList.filter((n) => n !== name)
            : [...currentList, name];
        }

        return {
          ...prev,
          recipients: {
            ...prev.recipients,
            vacation: { ...currentVacation, [subCategory]: newList },
          },
        };
      }

      // 2. 일반 알림 처리 (work, report, approval)
      const targetKey = category as keyof Omit<Recipients, "vacation">;
      const currentList = prev.recipients[targetKey] || [];
      const newList = currentList.includes(name)
        ? currentList.filter((n) => n !== name)
        : [...currentList, name];

      return {
        ...prev,
        recipients: { ...prev.recipients, [targetKey]: newList },
      };
    });
  };

  if (role !== "supervisor") {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-red-500 font-bold">🚫 접근 권한이 없습니다.</p>
      </div>
    );
  }

  if (isLoading) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="p-3">
      <h2 className="text-2xl font-bold mb-6">👥 직원 권한 및 결재선 관리</h2>

      {/* 직원 목록 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-1.5 px-2 border-b">이름</th>
              <th className="py-1.5 px-2 border-b">부서</th>
              <th className="py-1.5 px-2 border-b">권한</th>
              <th className="py-1.5 px-2 border-b text-center">설정</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="py-1.5 px-2 font-medium">{emp.userName}</td>
                <td className="py-1.5 px-2 text-gray-600">{emp.department}</td>
                <td className="py-1.5 px-2">
                  <span
                    className={`px-1.5 py-1.5 rounded text-xs font-bold ${
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
                <td className="p-1.5 text-center">
                  <button
                    onClick={() => openModal(emp)}
                    className="px-1.5 py-1.5 border border-[#519d9e] text-[#519d9e] rounded hover:bg-[#519d9e] hover:text-white transition-colors text-sm cursor-pointer"
                  >
                    관리
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && selectedEmp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white w-[600px] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-gray-100 p-1.5 border-b flex justify-between items-center">
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
                { key: "vacation", label: "휴가 결재선" }, // ✅ 추가됨
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
                      <option value="development">Development</option>
                      <option value="sales">Sales</option>
                      <option value="management">Management</option>
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
                      <option value="admin">Admin (팀장)</option>
                      <option value="supervisor">Supervisor (관리자)</option>
                      <option value="ceo">CEO</option>
                    </select>
                  </label>
                </div>
              )}

              {/* 2. 일반 알림 설정 탭 (work, report, approval) */}
              {(activeTab === "work" ||
                activeTab === "report" ||
                activeTab === "approval") && (
                <div>
                  <p className="text-sm text-gray-500 mb-3">
                    {selectedEmp.userName}님이
                    <span className="font-bold text-[#519d9e]">
                      {activeTab === "work"
                        ? " 일일/주간 업무보고"
                        : activeTab === "report"
                        ? " 보고서"
                        : " 품의서"}
                    </span>
                    를 작성할 때 알림을 받을 대상을 선택하세요.
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border p-2 rounded bg-gray-50">
                    {employees
                      .filter((e) => e.id !== selectedEmp.id)
                      .map((target) => (
                        <label
                          key={target.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                            tempData.recipients[activeTab].includes(
                              target.userName
                            )
                              ? "bg-blue-100 border-blue-200"
                              : "hover:bg-gray-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-[#519d9e]"
                            checked={tempData.recipients[activeTab].includes(
                              target.userName
                            )}
                            onChange={() =>
                              toggleRecipient(activeTab, target.userName)
                            }
                          />
                          <span className="text-sm">{target.userName}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              {/* 3. ✅ 휴가 결재선 설정 탭 */}
              {activeTab === "vacation" && (
                <div className="space-y-6">
                  {/* 1차 결재자 */}
                  <div>
                    <h4 className="font-bold text-[#519d9e] mb-2 text-sm">
                      1. 1차 결재자 (다중 선택 가능)
                    </h4>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border p-2 rounded bg-gray-50">
                      {employees
                        .filter((e) => e.id !== selectedEmp.id)
                        .map((target) => (
                          <label
                            key={`first-${target.id}`}
                            className="flex items-center gap-2 p-2 rounded hover:bg-gray-200 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-[#519d9e]"
                              checked={
                                tempData.recipients.vacation?.first?.includes(
                                  target.userName
                                ) || false
                              }
                              onChange={() =>
                                toggleRecipient(
                                  "vacation",
                                  target.userName,
                                  "first"
                                )
                              }
                            />
                            <span className="text-sm">{target.userName}</span>
                          </label>
                        ))}
                    </div>
                  </div>

                  {/* 2차 결재자 */}
                  <div>
                    <h4 className="font-bold text-red-500 mb-2 text-sm">
                      2. 2차 결재자 (1명만 선택 가능)
                    </h4>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border p-2 rounded bg-gray-50">
                      {employees
                        .filter((e) => e.id !== selectedEmp.id)
                        .map((target) => (
                          <label
                            key={`second-${target.id}`}
                            className="flex items-center gap-2 p-2 rounded hover:bg-gray-200 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-red-500"
                              checked={
                                tempData.recipients.vacation?.second?.includes(
                                  target.userName
                                ) || false
                              }
                              onChange={() =>
                                toggleRecipient(
                                  "vacation",
                                  target.userName,
                                  "second"
                                )
                              }
                            />
                            <span className="text-sm">{target.userName}</span>
                          </label>
                        ))}
                    </div>
                  </div>

                  {/* 공유자 */}
                  <div>
                    <h4 className="font-bold text-purple-600 mb-2 text-sm">
                      3. 공유/참조자 (승인 완료 시 알림)
                    </h4>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border p-2 rounded bg-gray-50">
                      {employees
                        .filter((e) => e.id !== selectedEmp.id)
                        .map((target) => (
                          <label
                            key={`shared-${target.id}`}
                            className="flex items-center gap-2 p-2 rounded hover:bg-gray-200 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-purple-600"
                              checked={
                                tempData.recipients.vacation?.shared?.includes(
                                  target.userName
                                ) || false
                              }
                              onChange={() =>
                                toggleRecipient(
                                  "vacation",
                                  target.userName,
                                  "shared"
                                )
                              }
                            />
                            <span className="text-sm">{target.userName}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                </div>
              )}
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
