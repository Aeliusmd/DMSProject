"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import useIsClient from "@/hooks/useIsClient";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";
import {
  getFacilitiesPaginated,
  searchFacilities,
} from "@/lib/facilities/facilityApi";
import {
  getOrdersPaginated,
  updateOrderFacility,
} from "@/lib/orders/orderApi";

const ORDERS_PER_PAGE = 10;
const FACILITIES_PER_PAGE = 10;

export default function FacilityOrdersModal({
  isOpen,
  facilityId,
  facilityName = "",
  onClose,
}) {
  const mounted = useIsClient();
  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assignModal, setAssignModal] = useState({
    open: false,
    order: null,
  });
  const [successMessage, setSuccessMessage] = useState("");

  const loadOrders = useCallback(
    async (page = 1) => {
      if (!facilityId) return;

      setLoading(true);
      setError("");

      try {
        const { orders: rows, pagination } = await getOrdersPaginated({
          facility: facilityId,
          pagination: "offset",
          page,
          pageSize: ORDERS_PER_PAGE,
        });

        const total = Number(pagination?.total) || 0;
        const pages = Math.max(1, Number(pagination?.totalPages) || 1);
        const responsePage = Number(pagination?.page) || page;

        if (rows.length === 0 && responsePage > 1 && total > 0) {
          setLoading(false);
          await loadOrders(responsePage - 1);
          return;
        }

        setOrders(rows);
        setTotalCount(total);
        setCurrentPage(responsePage);
        setTotalPages(pages);
      } catch (err) {
        setOrders([]);
        setTotalCount(0);
        setTotalPages(1);
        setError(getApiErrorMessage(err, "Failed to load facility orders"));
      } finally {
        setLoading(false);
      }
    },
    [facilityId]
  );

  useEffect(() => {
    if (!isOpen || !facilityId) return;

    setOrders([]);
    setTotalCount(0);
    setCurrentPage(1);
    setTotalPages(1);
    setError("");
    setSuccessMessage("");
    setAssignModal({ open: false, order: null });
    loadOrders(1);
  }, [isOpen, facilityId, loadOrders]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const pageButtons = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages]
  );

  if (!mounted || !isOpen || !facilityId) return null;

  const handleAssigned = async () => {
    setAssignModal({ open: false, order: null });
    setSuccessMessage("Order assigned to the selected facility.");
    await loadOrders(currentPage);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-6">
      <section className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[#0F172A]">Orders</h2>
            <p className="mt-1 truncate text-[12px] text-[#64748B]">
              {facilityName || `Facility #${facilityId}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[6px] border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="border-b border-[#E2E8F0] bg-[#F8FBFC] px-5 py-3">
          <p className="text-[13px] font-semibold text-[#0F172A]">
            Total orders: <span className="text-[#007F96]">{totalCount}</span>
          </p>
          {successMessage ? (
            <p className="mt-1 text-[11px] font-medium text-[#059669]">
              {successMessage}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {loading ? (
            <p className="py-10 text-center text-[13px] text-[#94A3B8]">
              Loading orders...
            </p>
          ) : error ? (
            <p className="py-10 text-center text-[13px] text-red-500">{error}</p>
          ) : orders.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[#94A3B8]">
              No orders found for this facility.
            </p>
          ) : (
            <ul className="space-y-2">
              {orders.map((order) => {
                const orderKey = order.dbId || order.id;
                const orderLabel = order.id || order.orderNumber || orderKey;

                return (
                  <li
                    key={orderKey}
                    className="flex flex-col gap-2 rounded-[8px] border border-[#E2E8F0] bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/orders/new?mode=edit&orderId=${order.dbId || ""}&returnTo=facilities`}
                        className="text-[12px] font-semibold text-[#007F96] hover:underline"
                      >
                        {orderLabel}
                      </Link>
                      {order.status || order.displayStatus ? (
                        <p className="mt-0.5 text-[11px] text-[#64748B]">
                          {order.displayStatus || order.status}
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSuccessMessage("");
                        setAssignModal({ open: true, order });
                      }}
                      className="inline-flex h-[30px] shrink-0 items-center justify-center rounded-[6px] border border-[#93C5FD] bg-[#EFF6FF] px-3 text-[11px] font-semibold text-[#2563EB] hover:bg-[#DBEAFE]"
                    >
                      Assign to another facility
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!loading && !error && totalCount > 0 ? (
          <footer className="flex flex-col gap-3 border-t border-[#E2E8F0] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-[#64748B]">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => loadOrders(currentPage - 1)}
                className="inline-flex h-[30px] min-w-[34px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>
              {pageButtons.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => loadOrders(page)}
                  className={`inline-flex h-[30px] min-w-[34px] items-center justify-center rounded-[6px] border px-2 text-[12px] font-semibold ${
                    page === currentPage
                      ? "border-[#0097B2] bg-[#E6F7FA] text-[#007F96]"
                      : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => loadOrders(currentPage + 1)}
                className="inline-flex h-[30px] min-w-[34px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </footer>
        ) : null}
      </section>

      <AssignOrderFacilityModal
        isOpen={assignModal.open}
        order={assignModal.order}
        currentFacilityId={facilityId}
        onClose={() => setAssignModal({ open: false, order: null })}
        onAssigned={handleAssigned}
      />
    </div>,
    document.body
  );
}

function AssignOrderFacilityModal({
  isOpen,
  order,
  currentFacilityId,
  onClose,
  onAssigned,
}) {
  const [search, setSearch] = useState("");
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assigningId, setAssigningId] = useState("");
  const [page, setPage] = useState(1);
  const [nextCursor, setNextCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([null]);

  const orderId = order?.dbId || order?.id;
  const orderLabel = order?.id || order?.orderNumber || orderId;
  const isSearching = search.trim().length >= 2;

  const filterOutCurrent = useCallback(
    (rows = []) =>
      rows.filter(
        (facility) => String(facility.id) !== String(currentFacilityId)
      ),
    [currentFacilityId]
  );

  const loadBrowsePage = useCallback(
    async (cursor = null) => {
      const result = await getFacilitiesPaginated({
        pagination: "keyset",
        pageSize: FACILITIES_PER_PAGE,
        cursor: cursor || undefined,
      });

      return {
        facilities: filterOutCurrent(result.facilities || []),
        nextCursor: result.pagination?.nextCursor || null,
        hasMore: Boolean(result.pagination?.hasMore),
      };
    },
    [filterOutCurrent]
  );

  const loadFacilities = useCallback(
    async (query = "") => {
      setLoading(true);
      setError("");

      try {
        const trimmed = `${query || ""}`.trim();

        if (trimmed.length >= 2) {
          const rows = await searchFacilities(trimmed);
          setFacilities(filterOutCurrent(rows));
          setNextCursor(null);
          setCursorHistory([null]);
          setPage(1);
          return;
        }

        const result = await loadBrowsePage(null);
        setFacilities(result.facilities);
        setNextCursor(result.hasMore ? result.nextCursor : null);
        setCursorHistory([null]);
        setPage(1);
      } catch (err) {
        setFacilities([]);
        setNextCursor(null);
        setError(getApiErrorMessage(err, "Failed to load facilities"));
      } finally {
        setLoading(false);
      }
    },
    [filterOutCurrent, loadBrowsePage]
  );

  useEffect(() => {
    if (!isOpen) return;

    setSearch("");
    setFacilities([]);
    setError("");
    setAssigningId("");
    setPage(1);
    setNextCursor(null);
    setCursorHistory([null]);
    loadFacilities("");
  }, [isOpen, loadFacilities]);

  if (!isOpen || !orderId) return null;

  const handleSearchChange = (value) => {
    setSearch(value);
    loadFacilities(value);
  };

  const goPrev = async () => {
    if (page <= 1 || loading || assigningId || isSearching) return;

    const prevPage = page - 1;
    const cursor = cursorHistory[prevPage - 1] || null;
    setLoading(true);
    setError("");

    try {
      const result = await loadBrowsePage(cursor);
      setFacilities(result.facilities);
      setNextCursor(result.hasMore ? result.nextCursor : null);
      setPage(prevPage);
      setCursorHistory((prev) => prev.slice(0, prevPage));
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load facilities"));
    } finally {
      setLoading(false);
    }
  };

  const goNext = async () => {
    if (!nextCursor || loading || assigningId || isSearching) return;

    setLoading(true);
    setError("");

    try {
      const cursor = nextCursor;
      const result = await loadBrowsePage(cursor);
      setFacilities(result.facilities);
      setNextCursor(result.hasMore ? result.nextCursor : null);
      setCursorHistory((prev) => [...prev.slice(0, page), cursor]);
      setPage((prev) => prev + 1);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load facilities"));
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (facility) => {
    if (!facility?.id || assigningId) return;

    setAssigningId(String(facility.id));
    setError("");

    try {
      await updateOrderFacility(orderId, {
        facilityId: facility.id,
        facilityName: facility.facility || "",
      });
      onAssigned?.(facility);
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Failed to assign order to selected facility")
      );
    } finally {
      setAssigningId("");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4 py-6">
      <section className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-[#0F172A]">
              Assign to another facility
            </h3>
            <p className="mt-1 text-[12px] text-[#64748B]">
              Order{" "}
              <span className="font-semibold text-[#334155]">{orderLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(assigningId)}
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[6px] border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="border-b border-[#E2E8F0] px-5 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search facilities..."
            className="h-[34px] w-full rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
          {loading && facilities.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#94A3B8]">
              Loading facilities...
            </p>
          ) : error ? (
            <p className="py-8 text-center text-[13px] text-red-500">{error}</p>
          ) : facilities.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#94A3B8]">
              No facilities found.
            </p>
          ) : (
            <ul className="space-y-2">
              {facilities.map((facility) => (
                <li key={facility.id}>
                  <button
                    type="button"
                    disabled={Boolean(assigningId)}
                    onClick={() => handleAssign(facility)}
                    className="flex w-full items-center justify-between gap-3 rounded-[8px] border border-[#E2E8F0] bg-white px-3 py-3 text-left hover:border-[#67D8E8] hover:bg-[#F0FBFD] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-[#0F172A]">
                        {facility.facility}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#64748B]">
                        {[facility.city, facility.zip]
                          .filter(Boolean)
                          .join(" · ") || `ID ${facility.id}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-[#007F96]">
                      {String(assigningId) === String(facility.id)
                        ? "Assigning..."
                        : "Select"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!isSearching ? (
          <footer className="flex items-center justify-end gap-1 border-t border-[#E2E8F0] px-5 py-3">
            <button
              type="button"
              disabled={page <= 1 || loading || Boolean(assigningId)}
              onClick={goPrev}
              className="inline-flex h-[30px] min-w-[34px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>
            <span className="px-2 text-[12px] font-semibold text-[#475569]">
              {page}
            </span>
            <button
              type="button"
              disabled={!nextCursor || loading || Boolean(assigningId)}
              onClick={goNext}
              className="inline-flex h-[30px] min-w-[34px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </footer>
        ) : null}
      </section>
    </div>,
    document.body
  );
}
