"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CompanyPortalDashboardShell from "@/components/company-portal/CompanyPortalDashboardShell";
import CompanyCreateEmployeeModal from "@/components/company-portal/CompanyCreateEmployeeModal";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { getCompanyCurrentUser } from "@/lib/company-portal/companyPortalAuthApi";
import {
  getCompanyAccessToken,
  getStoredCompanyUser,
} from "@/lib/company-portal/companyPortalAuthStorage";
import {
  createCompanyEmployee,
  formatMoney,
  listCompanyEmployeesPaginated,
} from "@/lib/company-portal/companyPortalManagementApi";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

const EMPLOYEES_PAGE_SIZE = 10;

export default function CompanyEmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState([null]);
  const cursorHistoryRef = useRef([null]);
  const [pagination, setPagination] = useState({
    pageSize: EMPLOYEES_PAGE_SIZE,
    hasMore: false,
    nextCursor: null,
  });
  const requestIdRef = useRef(0);

  useEffect(() => {
    cursorHistoryRef.current = cursorHistory;
  }, [cursorHistory]);

  const loadEmployeesPage = useCallback(
    async ({ page = 1, cursor = null, search = "" } = {}) => {
      const requestId = (requestIdRef.current += 1);
      setLoading(true);
      setError("");

      try {
        const response = await listCompanyEmployeesPaginated({
          search,
          cursor,
          pageSize: EMPLOYEES_PAGE_SIZE,
        });
        if (requestId !== requestIdRef.current) return;

        const data = response?.data || {};
        const pageMeta = data.pagination || {};
        setEmployees(data.employees || []);
        setPagination({
          pageSize: Number(pageMeta.pageSize) || EMPLOYEES_PAGE_SIZE,
          hasMore: Boolean(pageMeta.hasMore),
          nextCursor: pageMeta.nextCursor || null,
        });
        setCurrentPage(page);
        setCursorHistory((prev) => {
          const next = prev.slice(0, page - 1);
          next[page - 1] = cursor;
          if (pageMeta.hasMore && pageMeta.nextCursor) {
            next[page] = pageMeta.nextCursor;
          }
          return next;
        });
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(getApiErrorMessage(err, "Unable to load employees"));
        setEmployees([]);
        setPagination({
          pageSize: EMPLOYEES_PAGE_SIZE,
          hasMore: false,
          nextCursor: null,
        });
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!getCompanyAccessToken()) {
      router.replace("/company-portal/login");
      return;
    }

    const user = getStoredCompanyUser();
    if (user && user.isAdmin === false) {
      router.replace("/company-portal/dashboard");
      return;
    }

    getCompanyCurrentUser().catch(() => router.replace("/company-portal/login"));
    loadEmployeesPage({ page: 1, cursor: null, search: "" });
  }, [router, loadEmployeesPage]);

  const handleSearch = (event) => {
    event.preventDefault();
    const nextSearch = searchDraft.trim();
    setAppliedSearch(nextSearch);
    const nextHistory = [null];
    cursorHistoryRef.current = nextHistory;
    setCursorHistory(nextHistory);
    loadEmployeesPage({ page: 1, cursor: null, search: nextSearch });
  };

  const handleCreate = async (payload) => {
    setCreating(true);
    try {
      await createCompanyEmployee(payload);
      setModalOpen(false);
      setSuccessMessage("Employee created and credentials emailed successfully.");
      const nextHistory = [null];
      cursorHistoryRef.current = nextHistory;
      setCursorHistory(nextHistory);
      await loadEmployeesPage({
        page: 1,
        cursor: null,
        search: appliedSearch,
      });
    } finally {
      setCreating(false);
    }
  };

  const goPrev = () => {
    if (currentPage <= 1 || loading) return;
    const prevPage = currentPage - 1;
    const cursor = cursorHistoryRef.current[prevPage - 1] ?? null;
    loadEmployeesPage({ page: prevPage, cursor, search: appliedSearch });
  };

  const goNext = () => {
    if (!pagination.hasMore || loading) return;
    const nextPage = currentPage + 1;
    const cursor =
      pagination.nextCursor || cursorHistoryRef.current[currentPage] || null;
    if (!cursor) return;
    loadEmployeesPage({ page: nextPage, cursor, search: appliedSearch });
  };

  return (
    <CompanyPortalDashboardShell title="Employee Management">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[18px] font-semibold text-[#0F172A]">
              Company employees
            </h2>
            <p className="mt-1 text-[13px] text-[#64748B]">
              Create accounts for employees who will place orders using allocated
              wallet funds.
            </p>
          </div>
          <PrimaryButton type="button" onClick={() => setModalOpen(true)}>
            Create employee
          </PrimaryButton>
        </div>

        <form
          onSubmit={handleSearch}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search by name or email"
            className="h-11 flex-1 rounded-[8px] border border-[#E2E8F0] px-3 text-[13px] outline-none focus:border-[#0097B2]"
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
          >
            Search
          </button>
        </form>

        {successMessage ? (
          <p className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
            {error}
          </p>
        ) : null}

        <section className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Wallet balance</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last login</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-[#94A3B8]"
                    >
                      Loading employees...
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-[#94A3B8]"
                    >
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="border-t border-[#F1F5F9] text-[#334155]"
                    >
                      <td className="px-5 py-3 font-medium">{employee.name}</td>
                      <td className="px-5 py-3">{employee.email}</td>
                      <td className="px-5 py-3">
                        {formatMoney(employee.walletBalance)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            employee.isActive
                              ? "bg-[#ECFDF5] text-[#059669]"
                              : "bg-[#FEE2E2] text-[#DC2626]"
                          }`}
                        >
                          {employee.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {employee.lastLoginAt
                          ? new Date(employee.lastLoginAt).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#F1F5F9] px-5 py-3">
            <p className="text-[11px] text-[#64748B]">
              Page {currentPage}
              {pagination.hasMore ? " · more available" : ""}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={currentPage <= 1 || loading}
                className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-3 text-[12px] font-medium text-[#334155] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!pagination.hasMore || loading}
                className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-3 text-[12px] font-medium text-[#334155] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      <CompanyCreateEmployeeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        submitting={creating}
      />
    </CompanyPortalDashboardShell>
  );
}
