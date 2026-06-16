"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import ActivityLogTable from "@/components/activity-log/ActivityLogTable";
import { getActivityLogs } from "@/lib/activityLog/activityLogApi";

const filters = [
  "All Modules",
  "Orders",
  "Billing",
  "Employees",
  "Facilities",
  "Processing",
  "Reports",
  "Security",
];

export default function ActivityLogPage() {
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All Modules");
  const [dateFilters, setDateFilters] = useState({
    fromDate: "",
    toDate: "",
  });

  useEffect(() => {
    let cancelled = false;

    getActivityLogs()
      .then((logs) => {
        if (!cancelled) {
          setActivityLogs(logs);
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
  }, []);

  const filteredLogs = useMemo(() => {
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

      return matchesFilter && matchesFromDate && matchesToDate;
    });
  }, [activityLogs, activeFilter, dateFilters]);

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
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[18px] font-semibold text-[#111827]">
              Activity Log
            </h1>

            <p className="mt-1 text-[12px] text-[#64748B]">
              Track all system activities and user actions
            </p>
          </div>

          <Link
            href="/orders"
            className="inline-flex h-[34px] w-fit items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
          >
            <ArrowLeftIcon />
            Return to Orders
          </Link>
        </div>

        <div className="grid w-full grid-cols-1 items-end gap-4 2xl:grid-cols-[430px_auto_1fr]">
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
              : `Showing ${filteredLogs.length} of ${activityLogs.length} entries`}
          </p>
        </div>

        <ActivityLogTable logs={logsLoading ? [] : filteredLogs} />
      </div>
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
