"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import OrdersTable from "@/components/orders/OrdersTable";
import CurrentDateTime from "@/components/dashboard/CurrentDateTime";
import { getStoredUser } from "@/lib/auth/authStorage";
import { canAccessActivityReport } from "@/lib/auth/roles";
import { getFacilities } from "@/lib/facilities/facilityApi";
import { RUSH_LEVEL_LEGEND } from "@/lib/orders/rushUtils";

const STATUS_OPTIONS = [
  { value: "", label: "All (Active)" },
  { value: "active", label: "Active" },
  { value: "ready", label: "Ready" },
  { value: "ready_pickup", label: "Ready to Pickup" },
  { value: "writeoffs", label: "Write Offs" },
  { value: "cancelled", label: "Cancelled" },
  { value: "deleted", label: "Deleted" },
];

const RUSH_LEVEL_OPTIONS = [
  { value: "", label: "All Rush Levels" },
  ...RUSH_LEVEL_LEGEND.map(({ label }) => ({ value: label, label })),
];

const defaultDraftFilters = {
  facility: "",
  status: "",
  rushLevel: "",
  fromDate: "",
  toDate: "",
  sortDir: "asc",
};

export default function ReportsPage() {
  const user = getStoredUser();
  const showActivityReportLink = canAccessActivityReport(user);

  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(true);
  const [facilitiesError, setFacilitiesError] = useState("");

  const [draftFilters, setDraftFilters] = useState(defaultDraftFilters);
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    ...defaultDraftFilters,
    search: "",
  });
  const [summary, setSummary] = useState({
    total: 0,
    startRecord: 0,
    endRecord: 0,
    currentPage: 1,
    totalPages: 1,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    setFacilitiesLoading(true);

    getFacilities()
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setFacilities(list);
        setFacilitiesError("");

        if (list.length > 0) {
          const defaultFacilityId = String(list[0].id);
          setDraftFilters((prev) => ({
            ...prev,
            facility: prev.facility || defaultFacilityId,
          }));
          setAppliedFilters((prev) => ({
            ...prev,
            facility: prev.facility || defaultFacilityId,
          }));
        }
      })
      .catch((err) => {
        if (!active) return;
        setFacilities([]);
        setFacilitiesError(err?.message || "Failed to load facilities");
      })
      .finally(() => {
        if (active) setFacilitiesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateDraftFilter = (name, value) => {
    setDraftFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters((prev) => ({
      ...draftFilters,
      search: prev.search || "",
    }));
  };

  const handleSearch = () => {
    setAppliedFilters((prev) => ({
      ...prev,
      search: searchDraft.trim(),
    }));
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  };

  const handleReset = () => {
    const defaultFacilityId =
      facilities.length > 0 ? String(facilities[0].id) : "";
    const nextDraft = {
      ...defaultDraftFilters,
      facility: defaultFacilityId,
    };

    setDraftFilters(nextDraft);
    setSearchDraft("");
    setAppliedFilters({
      ...nextDraft,
      search: "",
    });
  };

  const tableFilters = useMemo(
    () => ({
      facility: appliedFilters.facility,
      company: "",
      year: "",
      period: "",
      status: appliedFilters.status,
      rushLevel: appliedFilters.rushLevel,
      search: appliedFilters.search,
      createdFrom: appliedFilters.fromDate,
      createdTo: appliedFilters.toDate,
    }),
    [appliedFilters]
  );

  const handleSummaryChange = useCallback((next) => {
    setSummary(next);
  }, []);

  const facilityLabel = (facility) =>
    facility.facility || facility.facilityName || facility.name || `#${facility.id}`;

  const selectedFacilityName = useMemo(() => {
    const match = facilities.find(
      (facility) => String(facility.id) === String(appliedFilters.facility)
    );
    return match ? facilityLabel(match) : "";
  }, [facilities, appliedFilters.facility]);

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-3 overflow-hidden">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[18px] font-semibold text-[#111827] sm:text-[20px]">
                Reports
              </h1>

              {selectedFacilityName ? (
                <p className="mt-[2px] text-[14px] font-semibold text-[#0F172A]">
                  {selectedFacilityName} has{" "}
                  <span className="text-[#0097B2]">
                    {summary.loading ? "..." : summary.total}
                  </span>{" "}
                  {summary.total === 1 ? "order" : "orders"}
                </p>
              ) : (
                <p className="mt-[2px] text-[13px] text-[#64748B]">
                  Facility-based order report (excludes completed orders)
                </p>
              )}

              {summary.total > 0 && (
                <p className="mt-[2px] text-[12px] text-[#64748B]">
                  Showing {summary.startRecord}-{summary.endRecord} of{" "}
                  {summary.total} (page {summary.currentPage} of{" "}
                  {summary.totalPages})
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-wrap items-center gap-3 text-[10px]">
                {RUSH_LEVEL_LEGEND.map(({ color, label }) => (
                  <RushLegendDot key={label} color={color} label={label} />
                ))}
              </div>

              {showActivityReportLink && (
                <Link
                  href="/reports/activity-report"
                  className="inline-flex h-[30px] items-center justify-center gap-2 rounded-[6px] bg-[#0097B2] px-3 text-[11px] font-semibold text-white hover:bg-[#0086A0]"
                >
                  <ReportIcon />
                  Activity Report
                </Link>
              )}

              <div className="flex items-center gap-1 text-[11px] text-[#64748B]">
                <span>as of</span>
                <CurrentDateTime />
              </div>
            </div>
          </div>
        </div>

        <section className="rounded-[9px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
          <h2 className="mb-3 text-[13px] font-semibold text-[#111827]">
            Filters
          </h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(160px,1fr)_130px_130px_130px_130px_170px_auto_auto]">
            <div>
              <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
                Facility
              </label>
              <select
                value={draftFilters.facility}
                onChange={(e) => updateDraftFilter("facility", e.target.value)}
                disabled={facilitiesLoading || facilities.length === 0}
                className="h-[34px] w-full rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10 disabled:opacity-60"
              >
                {facilitiesLoading && <option value="">Loading...</option>}
                {!facilitiesLoading && facilities.length === 0 && (
                  <option value="">No facilities</option>
                )}
                {facilities.map((facility) => (
                  <option key={facility.id} value={String(facility.id)}>
                    {facilityLabel(facility)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
                Status
              </label>
              <select
                value={draftFilters.status}
                onChange={(e) => updateDraftFilter("status", e.target.value)}
                className="h-[34px] w-full rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
                Rush Level
              </label>
              <select
                value={draftFilters.rushLevel}
                onChange={(e) => updateDraftFilter("rushLevel", e.target.value)}
                className="h-[34px] w-full rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
              >
                {RUSH_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
                From (Created)
              </label>
              <input
                type="date"
                value={draftFilters.fromDate}
                max={draftFilters.toDate || undefined}
                onChange={(e) => updateDraftFilter("fromDate", e.target.value)}
                className="h-[34px] w-full rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
                To (Created)
              </label>
              <input
                type="date"
                value={draftFilters.toDate}
                min={draftFilters.fromDate || undefined}
                onChange={(e) => updateDraftFilter("toDate", e.target.value)}
                className="h-[34px] w-full rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
                Sort by Created
              </label>
              <button
                type="button"
                onClick={() =>
                  updateDraftFilter(
                    "sortDir",
                    draftFilters.sortDir === "asc" ? "desc" : "asc"
                  )
                }
                className="flex h-[34px] w-full items-center justify-between rounded-[6px] border border-[#E2E8F0] bg-white px-3 text-[12px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
              >
                <span>
                  {draftFilters.sortDir === "asc"
                    ? "Oldest → Newest"
                    : "Newest → Oldest"}
                </span>
                <SortIcon />
              </button>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="h-[34px] w-full whitespace-nowrap rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
              >
                Apply Filters
              </button>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleReset}
                className="h-[34px] w-full rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
                Search
              </label>
              <div className="flex h-[34px] min-w-0 items-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[#94A3B8]">
                <SearchIcon />
                <input
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search order ID, case, applicant..."
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSearch}
              className="h-[34px] whitespace-nowrap rounded-[6px] bg-[#0097B2] px-5 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
            >
              Search
            </button>
          </div>

          {facilitiesError && (
            <p className="mt-3 rounded-[6px] border border-[#FEE2E2] bg-[#FEF2F2] px-3 py-2 text-[11px] font-medium text-red-600">
              {facilitiesError}
            </p>
          )}
        </section>

        {facilitiesLoading ? (
          <div className="flex flex-1 items-center justify-center rounded-[9px] border border-[#E2E8F0] bg-white px-4 py-16 text-[13px] text-[#94A3B8]">
            Loading facilities...
          </div>
        ) : facilities.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-[9px] border border-[#E2E8F0] bg-white px-4 py-16 text-[13px] text-[#94A3B8]">
            No facilities available to report on.
          </div>
        ) : !appliedFilters.facility ? (
          <div className="flex flex-1 items-center justify-center rounded-[9px] border border-[#E2E8F0] bg-white px-4 py-16 text-[13px] text-[#94A3B8]">
            Select a facility and click Apply Filters.
          </div>
        ) : (
          <OrdersTable
            filters={tableFilters}
            excludeCompleted
            createdSortDir={appliedFilters.sortDir}
            fitToWindow
            showDoctorColumn
            useServerPagination
            onSummaryChange={handleSummaryChange}
          />
        )}
      </div>
    </DashboardShell>
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

function SearchIcon() {
  return (
    <svg
      className="shrink-0"
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

function SortIcon() {
  return (
    <svg
      className="shrink-0 text-[#94A3B8]"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M6 20V4h12v16H6Z" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9 9h6M9 13h6M9 17h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
