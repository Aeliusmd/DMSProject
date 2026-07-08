"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import MatrixEmployeesTable from "@/components/employees/MatrixEmployeesTable";
import EmployeeFormModal from "@/components/employees/EmployeeFormModal";
import { getStoredUser } from "@/lib/auth/authStorage";
import { canAccessEmployeesPage, canManageEmployees } from "@/lib/auth/roles";
import {
  activateEmployee,
  createEmployee,
  deleteEmployee,
  getEmployeesPaginated,
  suspendEmployee,
  terminateEmployee,
  updateEmployee,
} from "@/lib/employees/employeeApi";

const EMPLOYEES_PER_PAGE = 10;

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [isNewEmployeeModalOpen, setIsNewEmployeeModalOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState([null]);
  const cursorHistoryRef = useRef([null]);
  const [pagination, setPagination] = useState({
    pageSize: EMPLOYEES_PER_PAGE,
    hasMore: false,
    nextCursor: null,
  });

  const user = getStoredUser();
  const readOnly = !canManageEmployees(user);

  const applySearch = () => {
    setAppliedSearch(searchInput.trim());
    setCurrentPage(1);
    setCursorHistory([null]);
    setPagination({
      pageSize: EMPLOYEES_PER_PAGE,
      hasMore: false,
      nextCursor: null,
    });
  };

  const clearSearch = () => {
    setSearchInput("");
    setAppliedSearch("");
    setCurrentPage(1);
    setCursorHistory([null]);
    setPagination({
      pageSize: EMPLOYEES_PER_PAGE,
      hasMore: false,
      nextCursor: null,
    });
  };

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    setPageError("");

    try {
      const cursor = cursorHistoryRef.current[currentPage - 1] ?? null;
      const result = await getEmployeesPaginated({
        search: appliedSearch,
        pagination: "keyset",
        cursor,
        pageSize: EMPLOYEES_PER_PAGE,
      });
      const hasMore = Boolean(result.pagination?.hasMore);
      const nextCursor = result.pagination?.nextCursor ?? null;

      setEmployees(result.employees || []);
      setPagination({
        pageSize: Number(result.pagination?.pageSize) || EMPLOYEES_PER_PAGE,
        hasMore,
        nextCursor,
      });
      setCursorHistory((prev) => {
        const next = prev.slice(0, currentPage);
        if (hasMore && nextCursor != null) {
          next[currentPage] = nextCursor;
        }
        if (!hasMore) {
          next.length = currentPage;
        }
        return next;
      });
    } catch (error) {
      if (error.status === 403) {
        router.replace("/dashboard");
        return;
      }

      setPageError(error.message || "Unable to load employees");
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch, currentPage, router]);

  useEffect(() => {
    const currentUser = getStoredUser();

    if (!canAccessEmployeesPage(currentUser)) {
      router.replace("/dashboard");
      return;
    }

    loadEmployees();
  }, [loadEmployees, router]);

  useEffect(() => {
    cursorHistoryRef.current = cursorHistory;
  }, [cursorHistory]);

  const handleCreateEmployee = async (newEmployeeData) => {
    await createEmployee(newEmployeeData);
    setIsNewEmployeeModalOpen(false);
    setCurrentPage(1);
    setCursorHistory([null]);
    await loadEmployees();
  };

  const handleUpdateEmployee = async (payload) => {
    if (!editEmployee) return;

    const updated = await updateEmployee(editEmployee.id, payload);
    setEmployees((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setEditEmployee(null);
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

  const handleSuspendEmployee = async (employee, reactivatedDate) => {
    const updatedEmployee = await suspendEmployee(employee.id, reactivatedDate);
    setEmployees((prev) =>
      prev.map((item) => (item.id === updatedEmployee.id ? updatedEmployee : item))
    );
    return updatedEmployee;
  };

  const handleDeleteEmployee = async (employee) => {
    await deleteEmployee(employee.id);
    await loadEmployees();
  };

  const totalPages = Math.max(currentPage + (pagination.hasMore ? 1 : 0), 1);
  const startRecord = employees.length
    ? (currentPage - 1) * EMPLOYEES_PER_PAGE + 1
    : 0;
  const endRecord = startRecord + employees.length - (employees.length ? 1 : 0);

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

            {!readOnly && (
              <button
                type="button"
                onClick={() => setIsNewEmployeeModalOpen(true)}
                className="inline-flex h-[36px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-[#0086A0]"
              >
                <UserPlusIcon />
                New Matrix Employee
              </button>
            )}
          </div>
        </div>

        {pageError && (
          <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
            {pageError}
          </p>
        )}

        {!isLoading && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <EmployeeSearch
              value={searchInput}
              onChange={setSearchInput}
              onSearch={applySearch}
              onClear={clearSearch}
              hasApplied={Boolean(appliedSearch.trim())}
            />

            <p className="text-[11px] text-[#64748B]">
              {appliedSearch.trim()
                ? pagination.hasMore
                  ? `Showing ${startRecord}-${endRecord} of ${endRecord}+ employees`
                  : `Showing ${startRecord}-${endRecord} of ${endRecord} employees`
                : pagination.hasMore
                  ? `Showing ${startRecord}-${endRecord} of ${endRecord}+ employees`
                  : `${endRecord} employees`}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center rounded-[10px] border border-[#E2E8F0] bg-white">
            <p className="text-[13px] text-[#64748B]">Loading employees...</p>
          </div>
        ) : (
          <MatrixEmployeesTable
            employees={employees}
            readOnly={readOnly}
            onEditEmployee={setEditEmployee}
            onTerminateEmployee={handleTerminateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onActivateEmployee={handleActivateEmployee}
            onSuspendEmployee={handleSuspendEmployee}
          />
        )}

        {!isLoading && (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
              disabled={currentPage === 1}
              className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>

            <span className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] bg-[#111827] px-2 text-[12px] font-semibold text-white">
              {currentPage}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) => Math.min(page + 1, totalPages))
              }
              disabled={currentPage >= totalPages || employees.length === 0}
              className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </div>
        )}

        {!readOnly && (
          <EmployeeFormModal
            open={isNewEmployeeModalOpen}
            onClose={() => setIsNewEmployeeModalOpen(false)}
            onCreate={handleCreateEmployee}
          />
        )}

        {!readOnly && (
          <EmployeeFormModal
            open={Boolean(editEmployee)}
            mode="edit"
            employee={editEmployee}
            onClose={() => setEditEmployee(null)}
            onUpdate={handleUpdateEmployee}
          />
        )}
      </div>
    </DashboardShell>
  );
}

function EmployeeSearch({ value, onChange, onSearch, onClear, hasApplied }) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSearch?.();
    }
  };

  return (
    <div className="w-full max-w-[360px]">
      <div className="flex gap-2">
        <div className="flex h-[36px] min-w-0 flex-1 items-center gap-2 rounded-[6px] border border-[#CBD5E1] bg-white px-3">
          <SearchIcon />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search employee name"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8]"
          />

          {value && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear search"
              className="shrink-0 text-[#94A3B8] hover:text-[#475569]"
            >
              <CloseIcon />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onSearch}
          className="h-[36px] shrink-0 rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
        >
          Filter
        </button>

        {hasApplied && (
          <button
            type="button"
            onClick={onClear}
            className="h-[36px] shrink-0 rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] hover:bg-[#F8FAFC]"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="shrink-0 text-[#94A3B8]"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
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
