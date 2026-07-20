"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import { getOrderActivityLogsPaginated } from "@/lib/orders/orderApi";
import { API_BASE_URL } from "@/config/api";

const LOGS_PAGE_SIZE = 10;
/** Keeps modal height stable while loading (~10 table rows). */
const TABLE_BODY_MIN_HEIGHT = "560px";

function toFileUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const origin = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

function ActivityLogRowSkeleton({ index }) {
  return (
    <tr
      className={`border-b border-[#F8FAFC] last:border-b-0 ${
        index % 2 === 0 ? "bg-white" : "bg-[#FCFEFF]"
      }`}
      aria-hidden
    >
      <td className="px-5 py-4 align-top">
        <div className="h-3 w-16 animate-pulse rounded bg-[#E2E8F0]" />
      </td>
      <td className="px-5 py-4 align-top">
        <div className="h-3 w-24 animate-pulse rounded bg-[#E2E8F0]" />
        <div className="mt-2 h-2 w-14 animate-pulse rounded bg-[#F1F5F9]" />
      </td>
      <td className="px-5 py-4 align-top">
        <div className="h-3 w-20 animate-pulse rounded bg-[#E2E8F0]" />
      </td>
      <td className="px-5 py-4 align-top">
        <div className="h-3 w-12 animate-pulse rounded bg-[#F1F5F9]" />
      </td>
      <td className="px-5 py-4 align-top">
        <div className="h-3 w-full max-w-[280px] animate-pulse rounded bg-[#E2E8F0]" />
        <div className="mt-2 h-3 w-[60%] max-w-[180px] animate-pulse rounded bg-[#F1F5F9]" />
      </td>
    </tr>
  );
}

function ActivityLogTableSkeleton() {
  return Array.from({ length: LOGS_PAGE_SIZE }, (_, index) => (
    <ActivityLogRowSkeleton key={`skeleton-${index}`} index={index} />
  ));
}

export default function OrderActivityLogModal({ isOpen, order, onClose }) {
  const mounted = useIsClient();
  const [searchValue, setSearchValue] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [keysetPagination, setKeysetPagination] = useState({
    pageSize: LOGS_PAGE_SIZE,
    hasMore: false,
    nextCursor: null,
  });
  const [cursorHistory, setCursorHistory] = useState([null]);
  const cursorHistoryRef = useRef([null]);
  const hasLoadedOnceRef = useRef(false);

  const orderId = order?.dbId ?? order?.id ?? null;
  const showSkeleton = loading;

  useEffect(() => {
    cursorHistoryRef.current = cursorHistory;
  }, [cursorHistory]);

  const loadLogsPage = useCallback(
    async (page = 1, search = appliedSearch) => {
      if (!orderId) return;

      setLoading(true);
      setLoadError("");

      try {
        const cursor = cursorHistoryRef.current[page - 1] ?? null;
        const result = await getOrderActivityLogsPaginated(orderId, {
          cursor,
          pageSize: LOGS_PAGE_SIZE,
          search,
        });

        const paginationMeta = result.pagination || {};
        const hasMore = Boolean(paginationMeta.hasMore);
        const nextCursor = paginationMeta.nextCursor ?? null;

        setLogs(result.logs || []);
        setKeysetPagination({
          pageSize: Number(paginationMeta.pageSize) || LOGS_PAGE_SIZE,
          hasMore,
          nextCursor,
        });
        setCursorHistory((prev) => {
          const next = prev.slice(0, page);
          if (hasMore && nextCursor != null) {
            next[page] = nextCursor;
          } else {
            next.length = page;
          }
          return next;
        });
        setCurrentPage(page);
        hasLoadedOnceRef.current = true;
      } catch (err) {
        setLogs([]);
        setLoadError(err.message || "Failed to load activity logs");
      } finally {
        setLoading(false);
      }
    },
    [orderId, appliedSearch]
  );

  useEffect(() => {
    if (!isOpen || !orderId) return undefined;

    setCursorHistory([null]);
    cursorHistoryRef.current = [null];
    setCurrentPage(1);
    hasLoadedOnceRef.current = false;
    setLogs([]);
    setLoading(true);
    loadLogsPage(1, appliedSearch);

    return undefined;
  }, [isOpen, orderId, appliedSearch, loadLogsPage]);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const timeoutId = window.setTimeout(() => {
      setAppliedSearch(searchValue.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, searchValue]);

  useEffect(() => {
    if (!isOpen) {
      setSearchValue("");
      setAppliedSearch("");
      setLogs([]);
      setKeysetPagination({
        pageSize: LOGS_PAGE_SIZE,
        hasMore: false,
        nextCursor: null,
      });
      setCursorHistory([null]);
      cursorHistoryRef.current = [null];
      setCurrentPage(1);
      setLoadError("");
      setLoading(false);
      hasLoadedOnceRef.current = false;
    }
  }, [isOpen]);

  const startRecord =
    logs.length === 0 ? 0 : (currentPage - 1) * LOGS_PAGE_SIZE + 1;
  const endRecord = logs.length === 0 ? 0 : startRecord + logs.length - 1;

  if (!mounted || !isOpen || !order) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/45 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex h-[min(720px,calc(100vh-44px))] w-full max-w-[820px] flex-col overflow-hidden rounded-[8px] bg-white shadow-2xl">
        <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[7px] bg-[#E6F7FA] text-[#007F96]">
              <ActivityIcon />
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="truncate text-[13px] font-semibold text-[#111827]">
                  Order Activity Log
                </h2>

                <span className="text-[11px] text-[#64748B]">— {order.id}</span>

                <span className="inline-flex h-[20px] min-w-[72px] items-center justify-center rounded-full bg-[#F1F5F9] px-2 text-[10px] font-semibold text-[#64748B]">
                  {showSkeleton ? (
                    <span className="h-2 w-10 animate-pulse rounded bg-[#E2E8F0]" />
                  ) : (
                    <>
                      {logs.length}
                      {keysetPagination.hasMore ? "+" : ""} on this page
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[6px] text-[18px] leading-none text-[#94A3B8] hover:bg-[#E2E8F0] hover:text-[#334155]"
            aria-label="Close activity log"
          >
            ×
          </button>
        </div>

        <div className="shrink-0 border-b border-[#F1F5F9] bg-white px-5 py-4">
          <div className="relative w-full max-w-[310px]">
            <SearchIcon />

            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search activity..."
              disabled={showSkeleton && !hasLoadedOnceRef.current}
              className="h-[38px] w-full rounded-[6px] border border-[#CBD5E1] bg-white pl-9 pr-3 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10 disabled:cursor-not-allowed disabled:bg-[#F8FAFC]"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-[#F1F5F9] text-left text-[11px] font-semibold text-[#64748B]">
                <th className="w-[120px] px-5 py-3">Date</th>
                <th className="w-[160px] px-5 py-3">Action</th>
                <th className="w-[140px] px-5 py-3">By</th>
                <th className="w-[100px] px-5 py-3">Callback</th>
                <th className="px-5 py-3">Details</th>
              </tr>
            </thead>

            <tbody>
              {showSkeleton ? <ActivityLogTableSkeleton /> : null}

              {!showSkeleton && loadError ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-14 text-center text-[13px] font-medium text-red-500"
                    style={{ height: TABLE_BODY_MIN_HEIGHT }}
                  >
                    {loadError}
                  </td>
                </tr>
              ) : null}

              {!showSkeleton &&
                !loadError &&
                logs.map((log, index) => (
                  <tr
                    key={log.id ?? `${log.date}-${index}`}
                    className="border-b border-[#F8FAFC] text-[12px] text-[#334155] last:border-b-0 odd:bg-white even:bg-[#FCFEFF] hover:bg-[#F8FBFC]"
                  >
                    <td className="px-5 py-4 align-top text-[#475569]">
                      {log.displayDate || log.date}
                    </td>

                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-[#111827]">
                          {log.action || "—"}
                        </span>
                        {log.module && log.module !== "Orders" ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                            {log.module}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-5 py-4 align-top font-semibold text-[#111827]">
                      {log.by}
                    </td>

                    <td className="px-5 py-4 align-top text-[#64748B]">
                      {log.callback || "–"}
                    </td>

                    <td className="px-5 py-4 align-top leading-[18px] text-[#334155]">
                      <div>{renderNote(log.note)}</div>

                      {log.attachmentUrl && (
                        <div className="mt-2">
                          <a
                            href={toFileUrl(log.attachmentUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-[11px] font-semibold text-[#0097B2] underline"
                          >
                            View attachment
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

              {!showSkeleton && !loadError && logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-14 text-center text-[13px] text-[#94A3B8]"
                    style={{ height: TABLE_BODY_MIN_HEIGHT }}
                  >
                    No activity logs found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex h-[52px] shrink-0 flex-col justify-center gap-3 border-t border-[#F1F5F9] bg-white px-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-h-[16px] text-[11px] text-[#64748B]">
            {showSkeleton ? (
              <span className="inline-block h-3 w-40 animate-pulse rounded bg-[#E2E8F0]" />
            ) : keysetPagination.hasMore ? (
              `Showing ${startRecord}-${endRecord} of ${endRecord}+ entries · ${LOGS_PAGE_SIZE} per page`
            ) : (
              `Showing ${startRecord}-${endRecord} of ${endRecord} entries · ${LOGS_PAGE_SIZE} per page`
            )}
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => loadLogsPage(currentPage - 1)}
              disabled={currentPage === 1 || showSkeleton}
              className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              ‹
            </button>

            <span className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] bg-[#111827] px-2 text-[12px] font-semibold text-white">
              {showSkeleton ? "…" : currentPage}
            </span>

            <button
              type="button"
              onClick={() => loadLogsPage(currentPage + 1)}
              disabled={
                !keysetPagination.hasMore || showSkeleton || logs.length === 0
              }
              className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}

function renderNote(note) {
  const lines = String(note).split("\n");

  return lines.map((line, lineIndex) => {
    const parts = line.split(/(CNR Letter|Copy Service Letter|Print Invoice)/g);

    return (
      <span key={lineIndex}>
        {lineIndex > 0 && <br />}
        {parts.map((part, index) => {
          if (
            part === "CNR Letter" ||
            part === "Copy Service Letter" ||
            part === "Print Invoice"
          ) {
            return (
              <span key={index} className="font-semibold text-[#2563EB]">
                {part}
              </span>
            );
          }

          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  });
}

function ActivityIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8v5l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 12a8 8 0 1 0 2.35-5.65"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 4v5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m20 20-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
