"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import ReportsOrdersTable from "@/components/reports/ReportsOrdersTable";
import CurrentDateTime from "@/components/dashboard/CurrentDateTime";
import { getStoredUser } from "@/lib/auth/authStorage";
import { canAccessActivityReport } from "@/lib/auth/roles";
import { getOrdersReport } from "@/lib/reports/reportApi";
import { RUSH_LEVEL_LEGEND } from "@/lib/orders/rushUtils";

const initialFilters = {
  orderNo: "",
  caseNumber: "",
  doctor: "",
  fromDate: "",
  toDate: "",
  rushLevel: "",
};

export default function ReportsPage() {
  const user = getStoredUser();
  const showActivityReportLink = canAccessActivityReport(user);
  const [filters, setFilters] = useState(initialFilters);
  const [showUnpaidOrders, setShowUnpaidOrders] = useState(false);
  const [minimumColumns, setMinimumColumns] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getOrdersReport({
        ...filters,
        unpaidOnly: showUnpaidOrders,
        showDuplicates,
      });

      setOrders(data.orders || []);
    } catch (err) {
      setOrders([]);
      setError(err.message || "Failed to load orders report");
    } finally {
      setLoading(false);
    }
  }, [filters, showUnpaidOrders, showDuplicates]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadReport();
    }, 300);

    return () => clearTimeout(timeout);
  }, [loadReport]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col overflow-hidden bg-white">
        <div className="flex flex-col gap-3 border-b border-[#E2E8F0] bg-white px-3 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-5">
              <h1 className="shrink-0 text-[15px] font-semibold text-[#111827]">
                DMS Orders
              </h1>

              <div className="hidden h-[22px] w-px bg-[#E2E8F0] md:block" />

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowUnpaidOrders((prev) => !prev)}
                  className={`text-[11px] font-semibold ${
                    showUnpaidOrders
                      ? "text-[#007F96]"
                      : "text-[#111827] hover:text-[#007F96]"
                  }`}
                >
                  Unpaid Orders
                </button>

                <button
                  type="button"
                  onClick={() => setMinimumColumns((prev) => !prev)}
                  className={`text-[11px] font-semibold ${
                    minimumColumns
                      ? "text-[#007F96]"
                      : "text-[#111827] hover:text-[#007F96]"
                  }`}
                >
                  Minimum Columns
                </button>

                <button
                  type="button"
                  onClick={() => setShowDuplicates((prev) => !prev)}
                  className={`text-[11px] font-semibold ${
                    showDuplicates
                      ? "text-[#007F96]"
                      : "text-[#111827] hover:text-[#007F96]"
                  }`}
                >
                  Show Duplicates
                </button>

                {showActivityReportLink && (
                  <Link
                    href="/reports/activity-report"
                    className="inline-flex h-[28px] items-center justify-center gap-2 rounded-[5px] bg-[#0097B2] px-3 text-[11px] font-semibold text-white hover:bg-[#0086A0]"
                  >
                    <ReportIcon />
                    Activity Report
                  </Link>
                )}

                <div className="hidden h-[22px] w-px bg-[#E2E8F0] md:block" />

                <div className="flex flex-wrap items-center gap-3 text-[10px]">
                  {RUSH_LEVEL_LEGEND.map(({ color, label }) => (
                    <RushLegendDot key={label} color={color} label={label} />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 text-[11px] text-[#111827]">
              <span>Found</span>
              <span className="font-semibold">
                {loading ? "..." : orders.length}
              </span>
              <span>records as of</span>
              <CurrentDateTime />
            </div>
          </div>

          <ReportsFilters
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
          />

          {error && (
            <div className="rounded-[6px] border border-[#FEE2E2] bg-[#FEF2F2] px-3 py-2 text-[11px] font-medium text-red-600">
              {error}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center px-4 py-16 text-[13px] text-[#94A3B8]">
            Loading orders report...
          </div>
        ) : (
          <ReportsOrdersTable
            orders={orders}
            minimumColumns={minimumColumns}
            recordsPerPage={25}
          />
        )}
      </div>
    </DashboardShell>
  );
}

function ReportsFilters({ filters, onChange, onReset }) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] p-2 md:grid-cols-2 xl:grid-cols-[150px_150px_150px_145px_145px_135px_auto]">
      <FilterInput
        label="Order Number"
        name="orderNo"
        value={filters.orderNo}
        onChange={onChange}
        placeholder="Order #"
      />

      <FilterInput
        label="Case Number"
        name="caseNumber"
        value={filters.caseNumber}
        onChange={onChange}
        placeholder="Case #"
      />

      <FilterInput
        label="Doctor"
        name="doctor"
        value={filters.doctor}
        onChange={onChange}
        placeholder="Doctor"
      />

      <DateFilter
        label="From Date"
        name="fromDate"
        value={filters.fromDate}
        onChange={onChange}
      />

      <DateFilter
        label="To Date"
        name="toDate"
        value={filters.toDate}
        onChange={onChange}
      />

      <RushFilter value={filters.rushLevel} onChange={onChange} />

      <button
        type="button"
        onClick={onReset}
        className="h-[28px] self-end rounded-[4px] border border-[#CBD5E1] bg-white px-3 text-[11px] font-semibold text-[#475569] hover:bg-[#F1F5F9]"
      >
        Reset
      </button>
    </div>
  );
}

function FilterInput({ label, name, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
        {label}
      </label>

      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-[28px] w-full rounded-[4px] border border-[#CBD5E1] bg-white px-2 text-[11px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2]"
      />
    </div>
  );
}

function DateFilter({ label, name, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
        {label}
      </label>

      <input
        type="date"
        name={name}
        value={value}
        onChange={onChange}
        className="h-[28px] w-full rounded-[4px] border border-[#CBD5E1] bg-white px-2 text-[11px] text-[#111827] outline-none focus:border-[#0097B2]"
      />
    </div>
  );
}

function RushFilter({ value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
        Rush Level
      </label>

      <select
        name="rushLevel"
        value={value}
        onChange={onChange}
        className="h-[28px] w-full rounded-[4px] border border-[#CBD5E1] bg-white px-2 text-[11px] text-[#111827] outline-none focus:border-[#0097B2]"
      >
        <option value="">All Rush</option>
        <option value="Rush 1">Rush 1</option>
        <option value="Rush 2">Rush 2</option>
        <option value="Rush 3">Rush 3</option>
      </select>
    </div>
  );
}

function RushLegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-[#64748B]">
      <span
        className="h-[6px] w-[6px] rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function ReportIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 20V4h12v16H6Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 9h6M9 13h6M9 17h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
