"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import MatrixEmployeesTable from "@/components/employees/MatrixEmployeesTable";
import EmployeeFormModal from "@/components/employees/EmployeeFormModal";
import { getStoredUser } from "@/lib/auth/authStorage";
import { canAccessEmployeesPage } from "@/lib/auth/roles";
import {
  activateEmployee,
  createEmployee,
  deleteEmployee,
  getEmployees,
  terminateEmployee,
} from "@/lib/employees/employeeApi";

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [isNewEmployeeModalOpen, setIsNewEmployeeModalOpen] = useState(false);

  useEffect(() => {
    const user = getStoredUser();

    if (!canAccessEmployeesPage(user)) {
      router.replace("/dashboard");
      return;
    }

    async function loadEmployees() {
      setIsLoading(true);
      setPageError("");

      try {
        const data = await getEmployees();
        setEmployees(data);
      } catch (error) {
        if (error.status === 403) {
          router.replace("/dashboard");
          return;
        }

        setPageError(error.message || "Unable to load employees");
      } finally {
        setIsLoading(false);
      }
    }

    loadEmployees();
  }, [router]);

  const handleCreateEmployee = async (newEmployeeData) => {
    const employee = await createEmployee(newEmployeeData);
    setEmployees((prev) => [employee, ...prev]);
    setIsNewEmployeeModalOpen(false);
  };

  const handleTerminateEmployee = async (employee) => {
    const updatedEmployee = await terminateEmployee(employee.id);
    setEmployees((prev) =>
      prev.map((item) => (item.id === updatedEmployee.id ? updatedEmployee : item))
    );
  };

  const handleActivateEmployee = async (employee) => {
    const updatedEmployee = await activateEmployee(employee.id);
    setEmployees((prev) =>
      prev.map((item) => (item.id === updatedEmployee.id ? updatedEmployee : item))
    );
    return updatedEmployee;
  };

  const handleDeleteEmployee = async (employee) => {
    await deleteEmployee(employee.id);
    setEmployees((prev) => prev.filter((item) => item.id !== employee.id));
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center">
          <h1 className="shrink-0 text-[18px] font-semibold text-[#111827]">
            List of Matrix Employees
          </h1>

          <div className="flex w-full flex-wrap items-center gap-3 lg:ml-auto lg:w-auto lg:justify-end">
            <Link
              href="/orders"
              className="inline-flex h-[36px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
            >
              <ArrowLeftIcon />
              Return to Orders
            </Link>

            <button
              type="button"
              onClick={() => setIsNewEmployeeModalOpen(true)}
              className="inline-flex h-[36px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-[#0086A0]"
            >
              <UserPlusIcon />
              New Matrix Employee
            </button>
          </div>
        </div>

        {pageError && (
          <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
            {pageError}
          </p>
        )}

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center rounded-[10px] border border-[#E2E8F0] bg-white">
            <p className="text-[13px] text-[#64748B]">Loading employees...</p>
          </div>
        ) : (
          <MatrixEmployeesTable
            employees={employees}
            onTerminateEmployee={handleTerminateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onActivateEmployee={handleActivateEmployee}
          />
        )}

        <EmployeeFormModal
          open={isNewEmployeeModalOpen}
          onClose={() => setIsNewEmployeeModalOpen(false)}
          onCreate={handleCreateEmployee}
        />
      </div>
    </DashboardShell>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M19 12H5M11 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19 8v6M22 11h-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
