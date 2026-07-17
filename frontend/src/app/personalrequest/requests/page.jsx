"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PersonalPortalDashboardShell from "@/components/personal-request/PersonalPortalDashboardShell";
import PersonalRecordsDownloadButton from "@/components/personal-request/PersonalRecordsDownloadButton";
import PersonalResearchFeeBanner from "@/components/personal-request/PersonalResearchFeeBanner";
import { listPersonalRequests } from "@/lib/personal-request/personalPortalAuthApi";
import {
  clearPersonalAuth,
  getPersonalAccessToken,
} from "@/lib/personal-request/personalPortalAuthStorage";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

const REQUESTS_PER_PAGE = 10;

const STATUS_STYLES = {
  in_process: "bg-[#E6F7FA] text-[#007F96]",
  invoice: "bg-[#FEF3C7] text-[#B45309]",
  paid: "bg-[#DBEAFE] text-[#1D4ED8]",
  released: "bg-[#DCFCE7] text-[#15803D]",
};

export default function PersonalRequestsListPage() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [keysetPagination, setKeysetPagination] = useState({
    pageSize: REQUESTS_PER_PAGE,
    hasMore: false,
    nextCursor: null,
  });
  const [cursorHistory, setCursorHistory] = useState([null]);
  const cursorHistoryRef = useRef([null]);

  useEffect(() => {
    cursorHistoryRef.current = cursorHistory;
  }, [cursorHistory]);

  const loadRequests = useCallback(
    async (page = 1) => {
      if (!getPersonalAccessToken()) {
        router.replace("/personalrequest/login");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const cursor = cursorHistoryRef.current[page - 1] ?? null;
        const response = await listPersonalRequests({
          pageSize: REQUESTS_PER_PAGE,
          cursor,
        });

        const paginationMeta = response?.data?.pagination || {};
        const hasMore = Boolean(paginationMeta.hasMore);
        const nextCursor = paginationMeta.nextCursor ?? null;

        setRequests(response?.data?.requests || []);
        setKeysetPagination({
          pageSize: Number(paginationMeta.pageSize) || REQUESTS_PER_PAGE,
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
      } catch (err) {
        if (err?.status === 401) {
          clearPersonalAuth();
          router.replace("/personalrequest/login");
          return;
        }
        setError(getApiErrorMessage(err, "Unable to load requests"));
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadRequests(1);
  }, [loadRequests]);

  const startRecord =
    requests.length === 0 ? 0 : (currentPage - 1) * REQUESTS_PER_PAGE + 1;
  const endRecord =
    requests.length === 0 ? 0 : startRecord + requests.length - 1;

  return (
    <PersonalPortalDashboardShell title="My Requests">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
            My Requests
          </h1>
          <p className="mt-1 text-[13px] text-[#64748B]">
            Paid requests from the last 7 days under your account. After the $35
            prepayment: In Process → Invoice → Paid → Released. Download records
            and receipts when available.
          </p>
        </div>
        <Link
          href="/personalrequest/new"
          className="inline-flex h-10 items-center rounded-[8px] bg-[#0097B2] px-4 text-[13px] font-semibold text-white hover:bg-[#0086A0]"
        >
          + New request
        </Link>
      </div>

      {error ? (
        <p className="mb-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {error}
        </p>
      ) : null}

      <PersonalResearchFeeBanner requests={requests} />

      <section className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
              <tr>
                <th className="px-5 py-3">Confirmation</th>
                <th className="px-5 py-3">Facility</th>
                <th className="px-5 py-3">Date range</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-[#94A3B8]"
                  >
                    Loading...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-[#94A3B8]"
                  >
                    No paid requests in the current 7-day window.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr
                    key={request.id || request.confirmationReference}
                    className="border-t border-[#F1F5F9]"
                  >
                    <td className="px-5 py-3 font-semibold text-[#0097B2]">
                      {request.confirmationReference || "—"}
                    </td>
                    <td className="px-5 py-3 text-[#334155]">
                      {request.treatingFacilityName || "—"}
                    </td>
                    <td className="px-5 py-3 text-[#334155]">
                      {request.recordsDateBegin || "—"} –{" "}
                      {request.recordsDateEnd || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          STATUS_STYLES[request.status] ||
                          "bg-[#F1F5F9] text-[#64748B]"
                        }`}
                      >
                        {request.statusLabel || request.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {request.receiptUrl ? (
                          <a
                            href={request.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-[#0097B2] hover:underline"
                          >
                            Receipt
                          </a>
                        ) : null}
                        {request.canDownload &&
                        (request.downloadToken || request.downloadUrl) ? (
                          <PersonalRecordsDownloadButton
                            downloadToken={request.downloadToken}
                            downloadUrl={request.downloadUrl}
                            label="Download"
                            className="font-semibold text-[#16A34A] hover:underline"
                          />
                        ) : (
                          <Link
                            href={`/personalrequest/status?ref=${encodeURIComponent(
                              request.confirmationReference || ""
                            )}`}
                            className="font-semibold text-[#0097B2] hover:underline"
                          >
                            View
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#F1F5F9] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-[#64748B]">
            {keysetPagination.hasMore
              ? `Showing ${startRecord}-${endRecord} of ${endRecord}+ requests`
              : `Showing ${startRecord}-${endRecord} of ${endRecord} requests`}
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => loadRequests(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              ‹
            </button>

            <span className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] bg-[#111827] px-2 text-[12px] font-semibold text-white">
              {currentPage}
            </span>

            <button
              type="button"
              onClick={() => loadRequests(currentPage + 1)}
              disabled={!keysetPagination.hasMore || loading || requests.length === 0}
              className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      </section>
    </PersonalPortalDashboardShell>
  );
}
