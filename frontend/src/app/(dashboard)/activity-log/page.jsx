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

export default function ActivityLogPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const ownLogsOnly = usesOwnActivityLogsOnly(user);
  const filters = ownLogsOnly ? employeeFilters : adminFilters;
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All Modules");
  const [dateFilters, setDateFilters] = useState({
    fromDate: "",
    toDate: "",
  });
  const [performerSearch, setPerformerSearch] = useState("");
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
    const performerQuery = performerSearch.trim().toLowerCase();

    return activityLogs.filter((log) => {
      const matchesFilter =
        activeFilter === "All Modules" || log.module === activeFilter;

      const logDate = parseDate(log.date);
      const fromDate = dateFilters.fromDate
        ? parseDate(dateFilters.fromDate)
        : null;
      const toDate = dateFilters.toDate ? parseDate(dateFilters.toDate) : null;

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
  }, [activityLogs, activeFilter, dateFilters, performerSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, dateFilters.fromDate, dateFilters.toDate, performerSearch]);

  const pagination = useMemo(
    () => paginateItems(filteredLogs, currentPage, DEFAULT_PAGE_SIZE),
    [filteredLogs, currentPage]
  );

  const handleDateFilterChange = (e) => {
    const { name, value } = e.target;

    setDateFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleResetDateFilters = () => {
    setDateFilters({
      fromDate: "",
      toDate: "",
    });
    setPerformerSearch("");
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

        <div className="grid w-full grid-cols-1 items-end gap-4 2xl:grid-cols-[430px_minmax(220px,280px)_auto_1fr]">
          <div className="grid w-full max-w-[430px] grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <DateFilter
              label="From"
              name="fromDate"
              value={dateFilters.fromDate}
              onChange={handleDateFilterChange}
            />

            <DateFilter
              label="To"
              name="toDate"
              value={dateFilters.toDate}
              onChange={handleDateFilterChange}
            />

            <button
              type="button"
              onClick={handleResetDateFilters}
              className="h-[36px] self-end rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
            >
              Reset
            </button>
          </div>

          {!ownLogsOnly && (
            <PerformerSearch
              value={performerSearch}
              onChange={setPerformerSearch}
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
                  onClick={() => setActiveFilter(filter)}
                  className={`h-[28px] shrink-0 rounded-[5px] px-4 text-[11px] font-semibold transition ${
                    activeFilter === filter
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

function PerformerSearch({ value, onChange }) {
  return (
    <div className="w-full max-w-[280px]">
      <label className="mb-2 block text-[11px] font-semibold text-[#64748B]">
        Performed By
      </label>

      <div className="flex h-[36px] items-center gap-2 rounded-[6px] border border-[#CBD5E1] bg-white px-3">
        <SearchIcon />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search employee name"
          className="min-w-0 flex-1 bg-transparent text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8]"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 text-[11px] font-semibold text-[#64748B] hover:text-[#334155]"
          >
            Clear
          </button>
        ) : null}
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
