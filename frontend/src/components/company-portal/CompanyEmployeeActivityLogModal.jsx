"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ActivityLogTable from "@/components/activity-log/ActivityLogTable";
import { getCompanyPortalActivityLogsPaginated } from "@/lib/company-portal/companyPortalActivityLogApi";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

const LOGS_PER_PAGE = 10;

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CompanyEmployeeActivityLogModal({
  open,
  employee,
  onClose,
}) {
  const todayDate = getTodayDateInput();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draftDates, setDraftDates] = useState({
    fromDate: todayDate,
    toDate: todayDate,
  });
  const [appliedDates, setAppliedDates] = useState({
    fromDate: todayDate,
    toDate: todayDate,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState([null]);
  const cursorHistoryRef = useRef([null]);
  const [pagination, setPagination] = useState({
    pageSize: LOGS_PER_PAGE,
    hasMore: false,
    nextCursor: null,
  });
  const requestIdRef = useRef(0);
  const employeeId = employee?.id ? Number(employee.id) : null;

  useEffect(() => {
    cursorHistoryRef.current = cursorHistory;
  }, [cursorHistory]);

  const loadPage = useCallback(
    async ({ page = 1, cursor = null } = {}) => {
      if (!employeeId) return;

      const requestId = (requestIdRef.current += 1);
      setLoading(true);
      setError("");

      try {
        const result = await getCompanyPortalActivityLogsPaginated({
          employeeId,
          fromDate: appliedDates.fromDate,
          toDate: appliedDates.toDate,
          pageSize: LOGS_PER_PAGE,
          cursor,
        });

        if (requestId !== requestIdRef.current) return;

        const pageMeta = result?.pagination || {};
        setLogs(result?.logs || []);
        setPagination({
          pageSize: Number(pageMeta.pageSize) || LOGS_PER_PAGE,
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
        setLogs([]);
        setPagination({
          pageSize: LOGS_PER_PAGE,
          hasMore: false,
          nextCursor: null,
        });
        setError(getApiErrorMessage(err, "Unable to load employee activity"));
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [employeeId, appliedDates.fromDate, appliedDates.toDate]
  );

  useEffect(() => {
    if (!open || !employeeId) return;

    const today = getTodayDateInput();
    setDraftDates({ fromDate: today, toDate: today });
    setAppliedDates({ fromDate: today, toDate: today });
    setError("");
    setLogs([]);
    const nextHistory = [null];
    cursorHistoryRef.current = nextHistory;
    setCursorHistory(nextHistory);
    setCurrentPage(1);
    setPagination({
      pageSize: LOGS_PER_PAGE,
      hasMore: false,
      nextCursor: null,
    });
  }, [open, employeeId]);

  useEffect(() => {
    if (!open || !employeeId) return;
    loadPage({ page: 1, cursor: null });
  }, [open, employeeId, appliedDates.fromDate, appliedDates.toDate, loadPage]);

  if (!open || !employee) return null;

  const handleApplyFilters = (event) => {
    event.preventDefault();
    const nextDates = {
      fromDate: draftDates.fromDate || getTodayDateInput(),
      toDate: draftDates.toDate || getTodayDateInput(),
    };
    const nextHistory = [null];
    cursorHistoryRef.current = nextHistory;
    setCursorHistory(nextHistory);
    setCurrentPage(1);
    setPagination({
      pageSize: LOGS_PER_PAGE,
      hasMore: false,
      nextCursor: null,
    });
    setAppliedDates(nextDates);
  };

  const handleResetFilters = () => {
    const today = getTodayDateInput();
    const nextDates = { fromDate: today, toDate: today };
    setDraftDates(nextDates);
    const nextHistory = [null];
    cursorHistoryRef.current = nextHistory;
    setCursorHistory(nextHistory);
    setCurrentPage(1);
    setPagination({
      pageSize: LOGS_PER_PAGE,
      hasMore: false,
      nextCursor: null,
    });
    setAppliedDates(nextDates);
  };

  const goPrev = () => {
    if (currentPage <= 1 || loading) return;
    const prevPage = currentPage - 1;
    const cursor = cursorHistoryRef.current[prevPage - 1] ?? null;
    loadPage({ page: prevPage, cursor });
  };

  const goNext = () => {
    if (!pagination.hasMore || loading || !pagination.nextCursor) return;
    loadPage({ page: currentPage + 1, cursor: pagination.nextCursor });
  };

  const startRecord = logs.length
    ? (currentPage - 1) * LOGS_PER_PAGE + 1
    : 0;
  const endRecord = startRecord + logs.length - (logs.length ? 1 : 0);
  const summaryLabel = loading
    ? "Loading activity logs..."
    : pagination.hasMore
      ? `Showing ${startRecord}-${endRecord} of ${endRecord}+ entries`
      : logs.length === 0
        ? "Showing 0 entries"
        : `Showing ${startRecord}-${endRecord} of ${endRecord} entries`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div
        className="flex max-h-[90vh] w-full max-w-[980px] flex-col overflow-hidden rounded-[12px] bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-activity-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
          <div>
            <h2
              id="employee-activity-title"
              className="text-[18px] font-semibold text-[#0F172A]"
            >
              Employee activity
            </h2>
            <p className="mt-1 text-[12px] text-[#64748B]">
              {employee.name}
              {employee.email ? ` · ${employee.email}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#64748B]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleApplyFilters}
          className="flex flex-wrap items-end gap-3 border-b border-[#F1F5F9] bg-[#F8FAFC] px-5 py-3"
        >
          <label className="block text-[11px] font-semibold text-[#64748B]">
            From
            <input
              type="date"
              value={draftDates.fromDate}
              onChange={(event) =>
                setDraftDates((prev) => ({
                  ...prev,
                  fromDate: event.target.value,
                }))
              }
              className="mt-1 h-[34px] w-[150px] rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#0F172A] outline-none focus:border-[#0097B2]"
            />
          </label>
          <label className="block text-[11px] font-semibold text-[#64748B]">
            To
            <input
              type="date"
              value={draftDates.toDate}
              onChange={(event) =>
                setDraftDates((prev) => ({
                  ...prev,
                  toDate: event.target.value,
                }))
              }
              className="mt-1 h-[34px] w-[150px] rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#0F172A] outline-none focus:border-[#0097B2]"
            />
          </label>
          <button
            type="submit"
            className="h-[34px] rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-[34px] rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
          >
            Reset
          </button>
          <p className="ml-auto text-[11px] text-[#64748B]">{summaryLabel}</p>
        </form>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {error ? (
            <p className="mb-3 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-16 text-[13px] text-[#94A3B8]">
              Loading activity logs...
            </div>
          ) : (
            <ActivityLogTable
              logs={logs}
              footer={
                <div className="flex items-center justify-end gap-2 border-t border-[#F1F5F9] bg-white px-4 py-3">
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={loading || currentPage <= 1}
                    className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-3 text-[12px] font-medium text-[#334155] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="px-2 text-[12px] text-[#64748B]">
                    Page {currentPage}
                  </span>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={loading || !pagination.hasMore}
                    className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-3 text-[12px] font-medium text-[#334155] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
