"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";
import { getOrdersPaginated } from "@/lib/orders/orderApi";
import { resolveRushLabel, buildRushBadgeTooltip } from "@/lib/orders/rushUtils";

const PAGE_SIZE = 8;
/** Fill the matched-height card without empty gap; then scroll loads more. */
const MAX_AUTO_FILL_PAGES = 6;

function mergeOrders(existing, incoming) {
  if (!incoming?.length) return existing;
  const seen = new Set(existing.map((order) => String(order.dbId || order.id)));
  const next = [...existing];
  for (const order of incoming) {
    const key = String(order.dbId || order.id);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(order);
  }
  return next;
}

export default function DashboardRecentOrders({ fillHeight = false }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const nextCursorRef = useRef(null);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const requestIdRef = useRef(0);
  const autoFillPagesRef = useRef(0);

  const loadOrders = useCallback(async ({ cursor = null, append = false } = {}) => {
    if (append) {
      if (loadingMoreRef.current || !hasMoreRef.current) return false;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else {
      requestIdRef.current += 1;
      autoFillPagesRef.current = 0;
      setLoading(true);
      setError("");
    }

    const requestId = requestIdRef.current;

    try {
      const { orders: rows, pagination } = await getOrdersPaginated({
        pagination: "keyset",
        pageSize: PAGE_SIZE,
        cursor: cursor || undefined,
      });

      if (requestId !== requestIdRef.current) return false;

      const pageRows = rows || [];
      setOrders((prev) => (append ? mergeOrders(prev, pageRows) : pageRows));

      const more = Boolean(pagination?.hasMore);
      const cursorValue = pagination?.nextCursor || null;
      hasMoreRef.current = more;
      nextCursorRef.current = cursorValue;
      setHasMore(more);
      return more && Boolean(cursorValue);
    } catch (err) {
      if (requestId !== requestIdRef.current) return false;
      if (!append) {
        setOrders([]);
        hasMoreRef.current = false;
        nextCursorRef.current = null;
        setHasMore(false);
        setError(getApiErrorMessage(err, "Failed to load orders"));
      }
      return false;
    } finally {
      if (requestId === requestIdRef.current) {
        if (append) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    loadOrders({ append: false });
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadOrders]);

  // Fill visible card height with rows (no empty gap), then stop until user scrolls.
  useEffect(() => {
    if (loading || loadingMore) return;
    if (!hasMoreRef.current || !nextCursorRef.current) return;
    if (autoFillPagesRef.current >= MAX_AUTO_FILL_PAGES) return;

    const el = scrollRef.current;
    if (!el) return;

    // Need a real overflow before we stop auto-filling.
    if (el.scrollHeight > el.clientHeight + 4) return;

    autoFillPagesRef.current += 1;
    const cursor = nextCursorRef.current;
    if (cursor) {
      loadOrders({ cursor, append: true });
    }
  }, [orders, loading, loadingMore, hasMore, loadOrders]);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (loadingMoreRef.current || !hasMoreRef.current) return;
        const cursor = nextCursorRef.current;
        if (!cursor) return;
        loadOrders({ cursor, append: true });
      },
      { root, rootMargin: "64px 0px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, orders.length, loadOrders]);

  return (
    <section
      className={`flex min-h-0 w-full flex-col overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm ${
        fillHeight ? "h-full" : ""
      }`}
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-[#F1F5F9] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-[#111827]">
            Recent Orders
          </h2>
          <p className="mt-0.5 text-[11px] text-[#94A3B8]">
            Latest orders from DMS Orders
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <LegendDot color="#EAB308" label="Rush 1" />
          <LegendDot color="#F97316" label="Rush 2" />
          <LegendDot color="#EF4444" label="Rush 3" />

          <Link
            href="/orders"
            className="font-semibold text-[#0097B2] hover:underline"
          >
            View All
          </Link>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`min-h-0 overflow-y-auto ${fillHeight ? "flex-1" : "max-h-[430px]"}`}
      >
        <table className="w-full min-w-[860px] border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-[#F1F5F9] text-left text-[11px] font-semibold text-[#64748B]">
              <th className="px-4 py-2.5">Order #</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Applicant</th>
              <th className="px-4 py-2.5">Provider</th>
              <th className="px-4 py-2.5">Subpoena Date</th>
              <th className="px-4 py-2.5">Rush</th>
              <th className="px-4 py-2.5">Invoice</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-[12px] text-[#94A3B8]"
                >
                  Loading orders...
                </td>
              </tr>
            )}

            {!loading && error && orders.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-[12px] font-medium text-red-500"
                >
                  {error}
                </td>
              </tr>
            )}

            {!loading &&
              orders.map((order) => (
                <tr
                  key={order.dbId || order.id}
                  className="border-b border-[#F8FAFC] last:border-b-0 hover:bg-[#F8FBFC]"
                >
                  <td className="px-4 py-2.5 align-middle">
                    <Link
                      href={`/orders/new?mode=edit&orderId=${encodeURIComponent(order.dbId)}`}
                      className="inline-flex rounded-[4px] bg-[#E6F7FA] px-2 py-1 text-[11px] font-semibold text-[#007F96] hover:underline"
                    >
                      {order.id}
                    </Link>
                    <p className="mt-1 text-[10px] text-[#94A3B8]">
                      {order.orderRef || order.caseNumber || "—"}
                    </p>
                  </td>

                  <td className="px-4 py-2.5 align-middle">
                    <StatusBadge status={order.status} />
                  </td>

                  <td className="px-4 py-2.5 text-[12px] text-[#334155]">
                    {order.applicant || "—"}
                  </td>

                  <td className="max-w-[160px] truncate px-4 py-2.5 text-[12px] text-[#334155]">
                    {order.providerName || order.company?.name || "—"}
                  </td>

                  <td className="px-4 py-2.5 text-[12px] text-[#334155]">
                    {order.subpoenaDateDisplay || order.subpoenaDate || "—"}
                  </td>

                  <td className="px-4 py-2.5">
                    <RushBadge rush={resolveRushLabel(order)} order={order} />
                  </td>

                  <td className="px-4 py-2.5">
                    <InvoiceBadge status={order.invoiceStatus} />
                  </td>
                </tr>
              ))}

            {!loading && !error && orders.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-[12px] text-[#94A3B8]"
                >
                  No orders found.
                </td>
              </tr>
            )}

            {loadingMore && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-2.5 text-center text-[11px] text-[#94A3B8]"
                >
                  Loading more...
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {hasMore ? (
          <div ref={sentinelRef} className="h-3 w-full" aria-hidden="true" />
        ) : null}
      </div>
    </section>
  );
}

function LegendDot({ color, label }) {
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

function StatusBadge({ status }) {
  const styles = {
    Active: "bg-[#ECFDF5] text-[#059669]",
    Ready: "bg-[#E6F7FA] text-[#007F96]",
    Completed: "bg-[#ECFDF5] text-[#059669]",
    Cancelled: "bg-[#F1F5F9] text-[#64748B]",
    "No Subpoena": "bg-[#F1F5F9] text-[#475569]",
  };

  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-full px-3 text-[10px] font-semibold ${
        styles[status] || "bg-[#F1F5F9] text-[#475569]"
      }`}
    >
      {status || "—"}
    </span>
  );
}

function RushBadge({ rush, order }) {
  if (!rush) {
    return <span className="text-[11px] text-[#CBD5E1]">—</span>;
  }

  const styles = {
    "Rush 1": "border-[#FDE68A] bg-[#FEF3C7] text-[#B45309]",
    "Rush 2": "border-[#FDBA74] bg-[#FFEDD5] text-[#EA580C]",
    "Rush 3": "border-[#FCA5A5] bg-[#FEE2E2] text-[#DC2626]",
  };

  const tooltip = buildRushBadgeTooltip(order, rush);

  return (
    <span
      title={tooltip}
      aria-label={tooltip || rush}
      className={`inline-flex h-[22px] items-center justify-center whitespace-nowrap rounded-full border px-3 text-[10px] font-semibold ${
        styles[rush] || "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]"
      }`}
    >
      {rush}
    </span>
  );
}

function InvoiceBadge({ status }) {
  const styles = {
    Pending: "bg-[#F1F5F9] text-[#64748B]",
    Unpaid: "bg-[#FEE2E2] text-red-500",
    Partial: "bg-[#DBEAFE] text-[#2563EB]",
    Paid: "bg-[#ECFDF5] text-[#059669]",
    "Written Off": "bg-[#F3E8FF] text-[#7C3AED]",
    "Needs Resend": "bg-[#FEF3C7] text-[#D97706]",
  };

  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-full px-3 text-[10px] font-semibold ${
        styles[status] || "bg-[#E6F7FA] text-[#007F96]"
      }`}
    >
      {status || "Pending"}
    </span>
  );
}
