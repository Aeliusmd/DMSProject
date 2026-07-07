"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import ActivityLogTable from "@/components/activity-log/ActivityLogTable";
import EmployeeMilestoneModal from "@/components/employees/EmployeeMilestoneModal";
import PaginationBar, {
  DEFAULT_PAGE_SIZE,
  paginateItems,
} from "@/components/ui/PaginationBar";
import { getCurrentUser } from "@/lib/auth/authApi";
import { getStoredUser } from "@/lib/auth/authStorage";
import { usesOwnActivityLogsOnly, isEmployee } from "@/lib/auth/roles";
import {
  getActivityLogs,
  getMyActivityLogs,
} from "@/lib/activityLog/activityLogApi";

const adminFilters = [
  "All Modules",
  "Orders",
  "Billing",
  "Employees",
  "Facilities",
  "Processing",
  "Reports",
  "Security",
];

const employeeFilters = [
  "All Modules",
  "Orders",
  "Billing",
  "Processing",
];

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ActivityLogPage() {
  const todayDate = getTodayDateInput();
  const [user, setUser] = useState(() => getStoredUser());
  const ownLogsOnly = usesOwnActivityLogsOnly(user);
  const filters = ownLogsOnly ? employeeFilters : adminFilters;
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
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
  const [performerSearchDraft, setPerformerSearchDraft] = useState("");
  const [appliedPerformerSearch, setAppliedPerformerSearch] = useState("");
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const showMyMilestone = isEmployee(user);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((currentUser) => {
        if (!cancelled && currentUser) {
          setUser(currentUser);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setLogsLoading(true);

    const loadLogs = ownLogsOnly ? getMyActivityLogs : getActivityLogs;

    loadLogs()
      .then((logs) => {
        if (!cancelled) {
          setActivityLogs(logs);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActivityLogs([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLogsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ownLogsOnly, user?.id, user?.role]);

  const filteredLogs = useMemo(() => {
    const performerQuery = appliedPerformerSearch.trim().toLowerCase();

    return activityLogs.filter((log) => {
      const matchesFilter =
        appliedActiveFilter === "All Modules" ||
        log.module === appliedActiveFilter;

      const logDate = parseDate(log.date);
      const fromDate = appliedDateFilters.fromDate
        ? parseDate(appliedDateFilters.fromDate)
        : null;
      const toDate = appliedDateFilters.toDate
        ? parseDate(appliedDateFilters.toDate)
        : null;

      const matchesFromDate = fromDate ? logDate >= fromDate : true;
      const matchesToDate = toDate ? logDate <= toDate : true;

      const matchesPerformer = performerQuery
        ? String(log.performedBy || "")
            .toLowerCase()
            .includes(performerQuery)
        : true;

      return (
        matchesFilter && matchesFromDate && matchesToDate && matchesPerformer
      );
    });
  }, [
    activityLogs,
    appliedActiveFilter,
    appliedDateFilters,
    appliedPerformerSearch,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    appliedActiveFilter,
    appliedDateFilters.fromDate,
    appliedDateFilters.toDate,
    appliedPerformerSearch,
  ]);

  const pagination = useMemo(
    () => paginateItems(filteredLogs, currentPage, DEFAULT_PAGE_SIZE),
    [filteredLogs, currentPage]
  );

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
  };

  const handleSearch = () => {
    setAppliedPerformerSearch(performerSearchDraft.trim());
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
    setPerformerSearchDraft("");
    setAppliedPerformerSearch("");
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[18px] font-semibold text-[#111827]">
              Activity Log
            </h1>

            <p className="mt-1 text-[12px] text-[#64748B]">
              {ownLogsOnly
                ? "Your activity history"
                : "Track all system activities and user actions"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {showMyMilestone ? (
              <button
                type="button"
                onClick={() => setMilestoneOpen(true)}
                className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] border border-[#BAE6FD] bg-[#F0F9FF] px-4 text-[12px] font-semibold text-[#0369A1] hover:bg-[#E0F2FE]"
              >
                View My Milestone
              </button>
            ) : null}

            <Link
              href="/orders"
              className="inline-flex h-[34px] w-fit items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
            >
              <ArrowLeftIcon />
              Return to Orders
            </Link>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 items-end gap-4 2xl:grid-cols-[minmax(430px,520px)_minmax(220px,320px)_auto_1fr]">
          <div className="grid w-full max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
            <DateFilter
              label="From"
              name="fromDate"
              value={draftDateFilters.fromDate}
              onChange={handleDateFilterChange}
            />

            <DateFilter
              label="To"
              name="toDate"
              value={draftDateFilters.toDate}
              onChange={handleDateFilterChange}
            />

            <button
              type="button"
              onClick={handleApplyFilters}
              className="h-[36px] self-end rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
            >
              Apply Filters
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              className="h-[36px] self-end rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
            >
              Reset
            </button>
          </div>

          {!ownLogsOnly && (
            <PerformerSearch
              value={performerSearchDraft}
              onChange={setPerformerSearchDraft}
              onSearch={handleSearch}
            />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <span className="shrink-0 text-[12px] font-medium text-[#64748B]">
              Filter:
            </span>

            <div className="flex flex-wrap items-center gap-1 rounded-[6px] border border-[#E2E8F0] bg-white p-[3px]">
              {filters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setDraftActiveFilter(filter)}
                  className={`h-[28px] shrink-0 rounded-[5px] px-4 text-[11px] font-semibold transition ${
                    draftActiveFilter === filter
                      ? "bg-[#0097B2] text-white shadow-sm"
                      : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111827]"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <p className="justify-self-start text-[11px] text-[#64748B] 2xl:justify-self-end">
            {logsLoading
              ? "Loading activity logs..."
              : `Showing ${pagination.startRecord}-${pagination.endRecord} of ${filteredLogs.length} entries`}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <ActivityLogTable
            logs={logsLoading ? [] : pagination.items}
            footer={
              !logsLoading ? (
                <PaginationBar
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
                  startRecord={pagination.startRecord}
                  endRecord={pagination.endRecord}
                  itemLabel="entries"
                  onPageChange={setCurrentPage}
                />
              ) : null
            }
          />
        </div>
      </div>

      <EmployeeMilestoneModal
        isOpen={milestoneOpen}
        useSelfStats
        onClose={() => setMilestoneOpen(false)}
      />
    </DashboardShell>
  );
}

function DateFilter({ label, name, value, onChange }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold text-[#64748B]">
        {label}
      </label>

      <input
        type="date"
        name={name}
        value={value}
        onChange={onChange}
        className="h-[36px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
      />
    </div>
  );
}

function PerformerSearch({ value, onChange, onSearch }) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSearch?.();
    }
  };

  return (
    <div className="w-full max-w-[320px]">
      <label className="mb-2 block text-[11px] font-semibold text-[#64748B]">
        Performed By
      </label>

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
        </div>

        <button
          type="button"
          onClick={onSearch}
          className="h-[36px] shrink-0 rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
        >
          Search
        </button>
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

function parseDate(dateValue) {
  return new Date(`${dateValue}T00:00:00`);
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
