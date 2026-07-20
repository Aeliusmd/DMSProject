"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CompanyPortalDashboardShell from "@/components/company-portal/CompanyPortalDashboardShell";
import ActivityLogTable from "@/components/activity-log/ActivityLogTable";
import { getCompanyCurrentUser } from "@/lib/company-portal/companyPortalAuthApi";
import {
  getCompanyAccessToken,
  getStoredCompanyUser,
} from "@/lib/company-portal/companyPortalAuthStorage";
import { getCompanyPortalActivityLogsPaginated } from "@/lib/company-portal/companyPortalActivityLogApi";
import { listCompanyEmployees } from "@/lib/company-portal/companyPortalManagementApi";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";
import { sanitizeSearchText } from "@/lib/company-portal/companyPortalValidation";

const ACTIVITY_LOGS_PER_PAGE = 10;

const MODULE_FILTERS = [
  "All Modules",
  "Orders",
  "Billing",
  "Employees",
  "Wallet",
  "Security",
];

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CompanyPortalActivityLogPage() {
  const router = useRouter();
  const todayDate = getTodayDateInput();

  const [activityLogs, setActivityLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [draftActiveFilter, setDraftActiveFilter] = useState("All Modules");
  const [appliedActiveFilter, setAppliedActiveFilter] = useState("All Modules");
  const [draftDateFilters, setDraftDateFilters] = useState({
    fromDate: todayDate,
    toDate: todayDate,
  });
  const [appliedDateFilters, setAppliedDateFilters] = useState({
    fromDate: todayDate,
    toDate: todayDate,
  });
  const [draftEmployeeFilter, setDraftEmployeeFilter] = useState("all");
  const [appliedEmployeeFilter, setAppliedEmployeeFilter] = useState("all");
  const [performerSearchDraft, setPerformerSearchDraft] = useState("");
  const [appliedPerformerSearch, setAppliedPerformerSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState([null]);
  const cursorHistoryRef = useRef([null]);
  const nextCursorRef = useRef(null);
  const [pagination, setPagination] = useState({
    pageSize: ACTIVITY_LOGS_PER_PAGE,
    hasMore: false,
    nextCursor: null,
  });

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

    listCompanyEmployees("")
      .then((response) => {
        setEmployees(response?.data?.employees || []);
      })
      .catch(() => {
        setEmployees([]);
      });
  }, [router]);

  useEffect(() => {
    cursorHistoryRef.current = cursorHistory;
  }, [cursorHistory]);

  const resetPagination = useCallback(() => {
    const nextHistory = [null];
    cursorHistoryRef.current = nextHistory;
    setCurrentPage(1);
    setCursorHistory(nextHistory);
    setPagination({
      pageSize: ACTIVITY_LOGS_PER_PAGE,
      hasMore: false,
      nextCursor: null,
    });
    nextCursorRef.current = null;
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setPageError("");

    try {
      let cursor = cursorHistoryRef.current[currentPage - 1] ?? null;
      if (cursor == null && currentPage === 2 && nextCursorRef.current != null) {
        cursor = nextCursorRef.current;
      }

      const requestFilters = {
        module: appliedActiveFilter,
        fromDate: appliedDateFilters.fromDate,
        toDate: appliedDateFilters.toDate,
        search: appliedPerformerSearch,
        cursor,
        pageSize: ACTIVITY_LOGS_PER_PAGE,
      };

      if (appliedEmployeeFilter === "admin") {
        requestFilters.actorType = "admin";
      } else if (appliedEmployeeFilter !== "all") {
        requestFilters.employeeId = appliedEmployeeFilter;
      }

      const result =
        await getCompanyPortalActivityLogsPaginated(requestFilters);

      const hasMore = Boolean(result.pagination?.hasMore);
      const nextCursor = result.pagination?.nextCursor ?? null;
      const logs = result.logs || [];

      if (!logs.length && currentPage > 1) {
        setPagination((prev) => ({
          ...prev,
          hasMore: false,
          nextCursor: null,
        }));
        const trimmedHistory = cursorHistoryRef.current.slice(
          0,
          currentPage - 1
        );
        cursorHistoryRef.current = trimmedHistory;
        setCursorHistory(trimmedHistory);
        setCurrentPage((page) => Math.max(page - 1, 1));
        return;
      }

      setActivityLogs(logs);
      setPagination({
        pageSize:
          Number(result.pagination?.pageSize) || ACTIVITY_LOGS_PER_PAGE,
        hasMore,
        nextCursor,
      });
      nextCursorRef.current = nextCursor;
      setCursorHistory((prev) => {
        const next = prev.slice(0, currentPage);
        if (hasMore && nextCursor != null) {
          next[currentPage] = nextCursor;
        }
        if (!hasMore) {
          next.length = currentPage;
        }
        cursorHistoryRef.current = next;
        return next;
      });
    } catch (error) {
      setPageError(
        getApiErrorMessage(error, "Failed to load activity logs")
      );
      setActivityLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [
    appliedActiveFilter,
    appliedDateFilters.fromDate,
    appliedDateFilters.toDate,
    appliedEmployeeFilter,
    appliedPerformerSearch,
    currentPage,
  ]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleDateFilterChange = (e) => {
    const { name, value } = e.target;
    setDraftDateFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApplyFilters = () => {
    setAppliedDateFilters({ ...draftDateFilters });
    setAppliedActiveFilter(draftActiveFilter);
    setAppliedEmployeeFilter(draftEmployeeFilter);
    resetPagination();
  };

  const handleSearch = () => {
    const sanitized = sanitizeSearchText(performerSearchDraft);
    setPerformerSearchDraft(sanitized);
    setAppliedPerformerSearch(sanitized);
    resetPagination();
  };

  const handleResetFilters = () => {
    const defaultDates = {
      fromDate: todayDate,
      toDate: todayDate,
    };

    setDraftDateFilters(defaultDates);
    setAppliedDateFilters(defaultDates);
    setDraftActiveFilter("All Modules");
    setAppliedActiveFilter("All Modules");
    setDraftEmployeeFilter("all");
    setAppliedEmployeeFilter("all");
    setPerformerSearchDraft("");
    setAppliedPerformerSearch("");
    resetPagination();
  };

  const totalPages = Math.max(currentPage + (pagination.hasMore ? 1 : 0), 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startRecord = activityLogs.length
    ? (safeCurrentPage - 1) * ACTIVITY_LOGS_PER_PAGE + 1
    : 0;
  const endRecord =
    startRecord + activityLogs.length - (activityLogs.length ? 1 : 0);

  if (currentPage !== safeCurrentPage) {
    setCurrentPage(safeCurrentPage);
  }

  const summaryLabel = logsLoading
    ? "Loading activity logs..."
    : pagination.hasMore
      ? `Showing ${startRecord}-${endRecord} of ${endRecord}+ entries`
      : activityLogs.length === 0
        ? "Showing 0 entries"
        : `Showing ${startRecord}-${endRecord} of ${endRecord} entries`;

  return (
    <CompanyPortalDashboardShell title="Activity Log">
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[18px] font-semibold text-[#111827]">
              Activity Log
            </h1>
            <p className="mt-1 text-[12px] text-[#64748B]">
              Monitor company admin and employee actions across your portal
            </p>
          </div>

          <Link
            href="/company-portal/dashboard"
            className="inline-flex h-[34px] w-fit items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
          >
            Return to Dashboard
          </Link>
        </div>

        {pageError ? (
          <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
            {pageError}
          </p>
        ) : null}

        <section className="rounded-[9px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="shrink-0 text-[10px] font-semibold text-[#64748B]">
                Filter:
              </span>

              <div className="flex flex-wrap items-center gap-1 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] p-[3px]">
                {MODULE_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setDraftActiveFilter(filter)}
                    className={`h-[28px] shrink-0 rounded-[5px] px-3 text-[11px] font-semibold transition ${
                      draftActiveFilter === filter
                        ? "bg-[#0097B2] text-white shadow-sm"
                        : "text-[#475569] hover:bg-white hover:text-[#111827]"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <DateFilter
              label="From"
              name="fromDate"
              value={draftDateFilters.fromDate}
              onChange={handleDateFilterChange}
              className="w-[140px]"
            />

            <DateFilter
              label="To"
              name="toDate"
              value={draftDateFilters.toDate}
              onChange={handleDateFilterChange}
              className="w-[140px]"
            />

            <div className="w-[200px]">
              <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
                Employee
              </label>
              <select
                value={draftEmployeeFilter}
                onChange={(event) => setDraftEmployeeFilter(event.target.value)}
                className="h-[34px] w-full rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
              >
                <option value="all">All actors</option>
                <option value="admin">Company admin</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={String(employee.id)}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex shrink-0 items-end gap-2">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="h-[34px] rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
              >
                Apply Filters
              </button>

              <button
                type="button"
                onClick={handleResetFilters}
                className="h-[34px] rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <PerformerSearch
              value={performerSearchDraft}
              onChange={setPerformerSearchDraft}
              onSearch={handleSearch}
              className="min-w-0 flex-1 sm:max-w-[360px]"
            />
          </div>

          <p className="mt-2 text-right text-[11px] text-[#64748B]">
            {summaryLabel}
          </p>
        </section>

        <div className="flex min-h-0 flex-1 flex-col">
          {logsLoading ? (
            <div className="flex flex-1 items-center justify-center rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-16 text-[13px] text-[#94A3B8]">
              Loading activity logs...
            </div>
          ) : (
            <ActivityLogTable
              logs={activityLogs}
              footer={
                <div className="flex items-center justify-end gap-1 border-t border-[#F1F5F9] bg-white px-4 py-3">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(page - 1, 1))
                    }
                    disabled={logsLoading || safeCurrentPage === 1}
                    className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ‹
                  </button>

                  <span className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] bg-[#111827] px-2 text-[12px] font-semibold text-white">
                    {safeCurrentPage}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        logsLoading ||
                        !pagination.hasMore ||
                        safeCurrentPage >= totalPages ||
                        activityLogs.length === 0
                      ) {
                        return;
                      }
                      setCurrentPage((page) => Math.min(page + 1, totalPages));
                    }}
                    disabled={
                      logsLoading ||
                      !pagination.hasMore ||
                      safeCurrentPage >= totalPages ||
                      activityLogs.length === 0
                    }
                    className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              }
            />
          )}
        </div>
      </div>
    </CompanyPortalDashboardShell>
  );
}

function DateFilter({ label, name, value, onChange, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
        {label}
      </label>
      <input
        type="date"
        name={name}
        value={value}
        onChange={onChange}
        className="h-[34px] w-full rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
      />
    </div>
  );
}

function PerformerSearch({ value, onChange, onSearch, className = "" }) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSearch?.();
    }
  };

  return (
    <div className={className}>
      <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
        Performed By
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(sanitizeSearchText(event.target.value))}
          onKeyDown={handleKeyDown}
          placeholder="Search by name"
          className="h-[34px] min-w-0 flex-1 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
        />
        <button
          type="button"
          onClick={onSearch}
          className="h-[34px] rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
        >
          Search
        </button>
      </div>
    </div>
  );
}
