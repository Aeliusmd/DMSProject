"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import { getStoredUser } from "@/lib/auth/authStorage";
import { isAdminOrManager } from "@/lib/auth/roles";
import {
  getEmployeeMilestoneStats,
  getMyMilestoneStats,
} from "@/lib/employees/employeeApi";
import { ApiRequestError } from "@/lib/auth/authApi";

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange() {
  return getPresetDateRange(1);
}

function getPresetDateRange(months) {
  const today = new Date();
  const start = new Date(today);
  start.setMonth(start.getMonth() - Number(months));

  return {
    from: formatDateInput(start),
    to: formatDateInput(today),
  };
}

const PRESET_RANGE_OPTIONS = [
  { value: "1", label: "1 month" },
  { value: "2", label: "2 months" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "1 year" },
  { value: "24", label: "2 years" },
];

const STAT_CARDS = [
  { key: "created", label: "Created Orders", color: "text-[#2563EB]", bg: "bg-[#EFF6FF]" },
  {
    key: "updated",
    label: "Updated Orders",
    color: "text-[#7C3AED]",
    bg: "bg-[#F5F3FF]",
  },
  {
    key: "completed",
    label: "Completed Orders",
    color: "text-[#059669]",
    bg: "bg-[#ECFDF5]",
  },
  {
    key: "cancelled",
    label: "Cancelled Orders",
    color: "text-[#B45309]",
    bg: "bg-[#FFFBEB]",
  },
  {
    key: "deleted",
    label: "Deleted Orders",
    color: "text-[#DC2626]",
    bg: "bg-[#FEF2F2]",
  },
];

function MilestoneStatsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            className={`rounded-[8px] border border-[#E2E8F0] px-4 py-3 ${card.bg}`}
          >
            <div className="h-3 w-24 animate-pulse rounded bg-[#E2E8F0]/80" />
            <div className="mt-3 h-7 w-12 animate-pulse rounded bg-[#E2E8F0]" />
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <div className="h-3 w-32 animate-pulse rounded bg-[#E2E8F0]/80" />
        <div className="mt-3 h-6 w-14 animate-pulse rounded bg-[#E2E8F0]" />
      </div>
    </>
  );
}

export default function EmployeeMilestoneModal({
  isOpen,
  employee = null,
  useSelfStats = false,
  onClose,
}) {
  const mounted = useIsClient();
  const user = getStoredUser();
  const canFilterByDate = isAdminOrManager(user);
  const defaultRange = getDefaultDateRange();

  const [draftDateFrom, setDraftDateFrom] = useState(defaultRange.from);
  const [draftDateTo, setDraftDateTo] = useState(defaultRange.to);
  const [presetMonths, setPresetMonths] = useState("1");
  const [appliedDateFrom, setAppliedDateFrom] = useState(defaultRange.from);
  const [appliedDateTo, setAppliedDateTo] = useState(defaultRange.to);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const showSkeleton = loading || (!error && stats === null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setStats(null);
      setError("");
      setLoading(true);
      return;
    }

    if (!useSelfStats && !employee?.id) {
      return;
    }

    const initialRange = getDefaultDateRange();
    setDraftDateFrom(initialRange.from);
    setDraftDateTo(initialRange.to);
    setPresetMonths("1");
    setAppliedDateFrom(initialRange.from);
    setAppliedDateTo(initialRange.to);
    setLoading(true);
    setError("");
    setStats(null);
  }, [isOpen, employee?.id, useSelfStats]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    if (!useSelfStats && !employee?.id) {
      return undefined;
    }

    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      setError("");
      setStats(null);

      try {
        const filters =
          canFilterByDate && !useSelfStats
            ? { from: appliedDateFrom, to: appliedDateTo }
            : {};

        const data = useSelfStats
          ? await getMyMilestoneStats(filters)
          : await getEmployeeMilestoneStats(employee?.id, filters);

        if (!cancelled) {
          setStats(
            data || {
              created: 0,
              updated: 0,
              completed: 0,
              cancelled: 0,
              deleted: 0,
              total: 0,
            }
          );
        }
      } catch (err) {
        if (!cancelled) {
          setStats(null);
          setError(
            err instanceof ApiRequestError
              ? err.message
              : "Unable to load milestone statistics"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    employee?.id,
    useSelfStats,
    canFilterByDate,
    appliedDateFrom,
    appliedDateTo,
  ]);

  const handleApplyCustomRangeFilter = () => {
    if (!draftDateFrom || !draftDateTo || draftDateFrom > draftDateTo) {
      return;
    }

    setAppliedDateFrom(draftDateFrom);
    setAppliedDateTo(draftDateTo);
  };

  const handleApplyPresetRangeFilter = () => {
    const range = getPresetDateRange(presetMonths);
    setDraftDateFrom(range.from);
    setDraftDateTo(range.to);
    setAppliedDateFrom(range.from);
    setAppliedDateTo(range.to);
  };

  const customRangeInvalid =
    !draftDateFrom || !draftDateTo || draftDateFrom > draftDateTo;

  if (!mounted || !isOpen) return null;

  const title = useSelfStats
    ? "My Milestone"
    : "Employee Milestone";
  const reference =
    stats?.employeeName || employee?.name || user?.name || "";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/45 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[calc(100vh-44px)] w-full max-w-[640px] flex-col overflow-hidden rounded-[8px] bg-white shadow-2xl">
        <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-[#111827]">{title}</h2>
            {reference ? (
              <p className="truncate text-[11px] text-[#64748B]">{reference}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] px-3 py-1.5 text-[12px] font-semibold text-[#64748B] hover:bg-white"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {canFilterByDate && !useSelfStats ? (
            <div className="mb-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-[#475569]">
                    From
                  </span>
                  <input
                    type="date"
                    value={draftDateFrom}
                    onChange={(e) => setDraftDateFrom(e.target.value)}
                    className="h-[36px] w-full rounded-[6px] border border-[#E2E8F0] px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-[#475569]">
                    To
                  </span>
                  <input
                    type="date"
                    value={draftDateTo}
                    onChange={(e) => setDraftDateTo(e.target.value)}
                    className="h-[36px] w-full rounded-[6px] border border-[#E2E8F0] px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleApplyCustomRangeFilter}
                  disabled={customRangeInvalid || loading}
                  className="inline-flex h-[36px] items-center justify-center rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Filter
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-[#475569]">
                    Quick range
                  </span>
                  <select
                    value={presetMonths}
                    onChange={(e) => setPresetMonths(e.target.value)}
                    className="h-[36px] w-full rounded-[6px] border border-[#E2E8F0] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
                  >
                    {PRESET_RANGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleApplyPresetRangeFilter}
                  disabled={loading}
                  className="inline-flex h-[36px] items-center justify-center rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Filter
                </button>
              </div>
            </div>
          ) : null}

          {!canFilterByDate || useSelfStats ? (
            <p className="mb-4 rounded-[6px] bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#64748B]">
              Created = orders you created. Updated, completed, cancelled, and
              deleted reflect actions you performed (from activity logs).
            </p>
          ) : (
            <p className="mb-4 rounded-[6px] bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#64748B]">
              Created = orders this employee created. Updated, completed,
              cancelled, and deleted = actions they performed. Use Filter on
              either row to apply the date range.
            </p>
          )}

          {showSkeleton ? (
            <MilestoneStatsSkeleton />
          ) : error ? (
            <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
              {error}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {STAT_CARDS.map((card) => (
                  <div
                    key={card.key}
                    className={`rounded-[8px] border border-[#E2E8F0] px-4 py-3 ${card.bg}`}
                  >
                    <p className="text-[11px] font-medium text-[#64748B]">
                      {card.label}
                    </p>
                    <p className={`mt-1 text-[24px] font-semibold ${card.color}`}>
                      {stats?.[card.key] ?? 0}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                <p className="text-[11px] font-medium text-[#64748B]">
                  Total Orders Tracked
                </p>
                <p className="mt-1 text-[20px] font-semibold text-[#111827]">
                  {stats?.total ?? 0}
                </p>
              </div>

              {canFilterByDate && !useSelfStats ? (
                <p className="mt-3 text-[10px] text-[#94A3B8]">
                  Filtered from {stats?.dateFrom || appliedDateFrom} to{" "}
                  {stats?.dateTo || appliedDateTo}
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}
