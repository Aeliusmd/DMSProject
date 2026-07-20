"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CompanyPortalDashboardShell from "@/components/company-portal/CompanyPortalDashboardShell";
import CompanyPortalRecentOrders from "@/components/company-portal/CompanyPortalRecentOrders";
import { isCompanyAuthenticated } from "@/lib/company-portal/companyPortalAuthStorage";
import { listCompanyPortalOrders } from "@/lib/company-portal/companyPortalOrderApi";
import { mapDashboardOrderRow } from "@/lib/company-portal/companyPortalOrderStatus";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";
import {
  hasHtmlMarkup,
  htmlMarkupError,
  sanitizeTrackOrderInput,
} from "@/lib/company-portal/companyPortalValidation";

const ORDERS_PAGE_SIZE = 10;

export default function CompanyPortalTrackEntryPage() {
  const router = useRouter();
  const [trackInput, setTrackInput] = useState("");
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState([null]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const requestIdRef = useRef(0);

  const loadOrdersPage = useCallback(async (page = 1, cursor = null) => {
    const requestId = (requestIdRef.current += 1);
    setOrdersLoading(true);
    setListError("");

    try {
      const response = await listCompanyPortalOrders({
        pagination: "keyset",
        cursor,
        pageSize: ORDERS_PAGE_SIZE,
      });
      if (requestId !== requestIdRef.current) return;

      const data = response?.data || {};
      const pagination = data.pagination || {};
      setOrders((data.orders || []).map(mapDashboardOrderRow));
      setHasMore(Boolean(pagination.hasMore));
      setNextCursor(pagination.nextCursor || null);
      setCurrentPage(page);
      setCursorHistory((prev) => {
        const next = prev.slice(0, page - 1);
        next[page - 1] = cursor;
        if (pagination.hasMore && pagination.nextCursor) {
          next[page] = pagination.nextCursor;
        }
        return next;
      });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setOrders([]);
      setHasMore(false);
      setNextCursor(null);
      setListError(getApiErrorMessage(err, "Unable to load orders"));
    } finally {
      if (requestId === requestIdRef.current) {
        setOrdersLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isCompanyAuthenticated()) {
      router.replace("/company-portal/login");
      return;
    }
    loadOrdersPage(1, null);
  }, [router, loadOrdersPage]);

  const handleTrack = (event) => {
    event.preventDefault();
    if (hasHtmlMarkup(trackInput)) {
      setError(htmlMarkupError("orderNumber"));
      return;
    }
    const value = sanitizeTrackOrderInput(trackInput);
    if (!value) {
      setError("Enter your order number to continue.");
      return;
    }
    router.push(`/company-portal/orders/track/${encodeURIComponent(value)}`);
  };

  return (
    <CompanyPortalDashboardShell title="Track Order">
      <div className="mx-auto max-w-[960px] space-y-5">
        <div>
          <h1 className="text-[22px] font-semibold text-[#111827]">
            Your placed orders
          </h1>
          <p className="mt-1 text-[13px] text-[#64748B]">
            Browse paginated orders (10 per page) or enter an order number to
            open tracking details.
          </p>
        </div>

        <form
          onSubmit={handleTrack}
          className="rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm"
        >
          <label className="block text-[12px] font-medium text-[#334155]">
            Order number
          </label>
          <input
            type="text"
            value={trackInput}
            onChange={(event) => {
              setTrackInput(sanitizeTrackOrderInput(event.target.value));
              if (error) setError("");
            }}
            placeholder="ORD-123456"
            className="mt-2 h-11 w-full rounded-[8px] border border-[#E2E8F0] px-3 text-[13px] outline-none focus:border-[#0097B2]"
          />
          {error ? (
            <p className="mt-2 text-[12px] text-red-600">{error}</p>
          ) : null}
          <button
            type="submit"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[8px] bg-[#0097B2] text-[13px] font-semibold text-white hover:bg-[#0086A0] sm:w-auto sm:px-6"
          >
            Track order
          </button>
        </form>

        {listError ? (
          <p className="text-[12px] text-red-600">{listError}</p>
        ) : null}

        <CompanyPortalRecentOrders
          orders={orders}
          loading={ordersLoading}
          title="All orders"
          subtitle="Browse your requests, 10 orders per page"
          onSelectOrder={(order) => {
            if (!order?.orderNumber) return;
            router.push(
              `/company-portal/orders/track/${encodeURIComponent(
                order.orderNumber
              )}`
            );
          }}
          currentPage={currentPage}
          hasMore={hasMore}
          pageSize={ORDERS_PAGE_SIZE}
          onPreviousPage={() => {
            if (currentPage <= 1 || ordersLoading) return;
            const previousCursor = cursorHistory[currentPage - 2] ?? null;
            loadOrdersPage(currentPage - 1, previousCursor);
          }}
          onNextPage={() => {
            if (!hasMore || ordersLoading || !nextCursor) return;
            loadOrdersPage(currentPage + 1, nextCursor);
          }}
        />
      </div>
    </CompanyPortalDashboardShell>
  );
}
