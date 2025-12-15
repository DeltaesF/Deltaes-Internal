"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

interface Recipients {
  work: string[];
  report: string[];
  approval: string[];
}

interface Employee {
  id: string;
  userName: string;
  email: string;
  department: string;
  role: string;

  // 알림 수신자 목록 (카테고리별)
  recipients?: {
    work?: string[]; // 일일/주간 업무
    report?: string[]; // 보고서
    approval?: string[]; // 품의서
  };
}

interface UpdateEmployeeData {
  id: string;
  role: string;
  department: string;
  recipients: Recipients;
}

type TabKey = "basic" | "work" | "report" | "approval";

const fetchEmployees = async () => {
  const res = await fetch("/api/supervisor/employees");
  if (!res.ok) throw new Error("Failed to fetch employees");
  return res.json();
};

export default function EmployeeManagementPage() {
  const { role } = useSelector((state: RootState) => state.auth);
  const queryClient = useQueryClient();
  // 모달 상태 관리
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("basic");

  // 수정 데이터 임시 저장소
  const [tempData, setTempData] = useState<{
    role: string;
    department: string;
    recipients: Recipients;
  }>({
    role: "",
    department: "",
    recipients: { work: [], report: [], approval: [] },
  });

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: fetchEmployees,
    enabled: role === "supervisor", // 슈퍼바이저만 호출
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

  // 모달 열기 (데이터 초기화)
  const openModal = (emp: Employee) => {
    setSelectedEmp(emp);
    setTempData({
      role: emp.role || "user",
      department: emp.department || "development",
      recipients: {
        work: emp.recipients?.work || [],
        report: emp.recipients?.report || [],
        approval: emp.recipients?.approval || [],
      },
    });
    setActiveTab("basic"); // 기본 탭으로 시작
    setIsModalOpen(true);
  };

  // 저장 핸들러
  const handleSave = () => {
    if (!selectedEmp) return;
    updateMutation.mutate({
      id: selectedEmp.id,
      ...tempData,
    });
  };

  // 수신자 토글 핸들러
  const toggleRecipient = (category: keyof Recipients, name: string) => {
    setTempData((prev) => {
      const currentList = prev.recipients[category];
      const newList = currentList.includes(name)
        ? currentList.filter((n) => n !== name)
        : [...currentList, name];
      return {
        ...prev,
        recipients: { ...prev.recipients, [category]: newList },
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
      <h2 className="text-2xl font-bold mb-6">👥 직원 권한 관리</h2>
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
                    className="px-1.5 py-1.5 border border-[#519d9e] text-[#519d9e] rounded hover:bg-[#519d9e] hover:text-white transition-colors text-sm"
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
          <div className="bg-white w-[600px] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="bg-gray-100 p-1.5 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">
                ⚙️ {selectedEmp.userName}님 설정
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex border-b bg-white gap-4 px-4">
              {[
                { key: "basic", label: "기본 정보" },
                { key: "work", label: "업무보고 알림" },
                { key: "report", label: "보고서 알림" },
                { key: "approval", label: "품의서 알림" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  // [수정] any 제거하고 TabKey 타입으로 단언
                  onClick={() => setActiveTab(tab.key as TabKey)}
                  className={`flex-1.5 py-3 text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === tab.key
                      ? "border-b-1.5 border-[#519d9e] text-[#519d9e] bg-blue-50"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto flex-1.5">
              {activeTab === "basic" && (
                <div className="flex flex-col gap-1.5">
                  <label className="block">
                    <span className="text-gray-700 font-semibold text-sm">
                      부서
                    </span>
                    <select
                      value={tempData.department}
                      onChange={(e) =>
                        setTempData({ ...tempData, department: e.target.value })
                      }
                      className="w-full mt-1.5 border p-1.5 rounded focus:ring-1.5 focus:ring-[#519d9e]"
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
                      className="w-full mt-1.5 border p-1.5 rounded focus:ring-1.5 focus:ring-[#519d9e]"
                    >
                      <option value="user">User (일반)</option>
                      <option value="admin">Admin (팀장)</option>
                      <option value="supervisor">Supervisor (관리자)</option>
                      <option value="ceo">CEO</option>
                    </select>
                  </label>
                </div>
              )}

              {activeTab !== "basic" && (
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

                  <div className="grid grid-cols-1.5 gap-1.5 max-h-60 overflow-y-auto border p-1.5 rounded bg-gray-50">
                    {employees
                      .filter((e) => e.id !== selectedEmp.id)
                      .map((target) => (
                        <label
                          key={target.id}
                          className={`flex items-center gap-1.5 p-1.5 rounded cursor-pointer transition-colors ${
                            tempData.recipients[activeTab].includes(
                              target.userName
                            )
                              ? "bg-blue-100 border-blue-200"
                              : "hover:bg-gray-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-2.5 h-2.5 accent-[#519d9e]"
                            checked={tempData.recipients[activeTab].includes(
                              target.userName
                            )}
                            onChange={() =>
                              toggleRecipient(
                                activeTab as keyof Recipients,
                                target.userName
                              )
                            }
                          />
                          <span className="text-sm">{target.userName}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-1.5 border-t bg-gray-50 flex justify-end gap-1.5">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-1.5 py-1.5 rounded bg-gray-300 hover:bg-gray-400 text-sm font-medium"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-1.5 rounded bg-[#519d9e] text-white hover:bg-[#407f80] text-sm font-bold shadow-md"
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
