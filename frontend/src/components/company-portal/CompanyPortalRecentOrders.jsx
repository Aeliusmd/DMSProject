"use client";

import { getOrderStatusStyles } from "@/lib/company-portal/companyPortalOrderStatus";

function formatDisplayDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CompanyPortalRecentOrders({
  orders = [],
  loading = false,
  title = "Recent orders",
  subtitle = "Latest requests from your company account",
  onViewAll,
  onSelectOrder,
  currentPage = 1,
  hasMore = false,
  pageSize = 10,
  onPreviousPage,
  onNextPage,
}) {
  const startRecord =
    orders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord =
    orders.length === 0 ? 0 : (currentPage - 1) * pageSize + orders.length;

  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[#F1F5F9] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#111827]">{title}</h2>
          <p className="mt-1 text-[12px] text-[#64748B]">{subtitle}</p>
        </div>

        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-[12px] font-medium text-[#0097B2] hover:underline"
          >
            View all
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[12px]">
          <thead className="bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
            <tr>
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Applicant</th>
              <th className="px-5 py-3">Facility</th>
              <th className="px-5 py-3">Requested</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-8 text-center text-[#94A3B8]"
                >
                  Loading orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-8 text-center text-[#94A3B8]"
                >
                  No orders yet. Create your first subpoena request to get
                  started.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-t border-[#F1F5F9] text-[#334155]"
                >
                  <td className="px-5 py-3 font-semibold text-[#0097B2]">
                    {onSelectOrder ? (
                      <button
                        type="button"
                        onClick={() => onSelectOrder(order)}
                        className="hover:underline"
                      >
                        {order.orderNumber}
                      </button>
                    ) : (
                      order.orderNumber
                    )}
                  </td>
                  <td className="px-5 py-3">{order.applicant}</td>
                  <td className="px-5 py-3">{order.facility}</td>
                  <td className="px-5 py-3">
                    {formatDisplayDate(order.dateRequested)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getOrderStatusStyles(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {onPreviousPage || onNextPage ? (
        <div className="flex flex-col gap-3 border-t border-[#F1F5F9] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-[#64748B]">
            {orders.length === 0
              ? "Showing 0 orders"
              : hasMore
                ? `Showing ${startRecord}-${endRecord} of ${endRecord}+ orders`
                : `Showing ${startRecord}-${endRecord} of ${endRecord} orders`}
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPreviousPage}
              disabled={currentPage <= 1 || loading || !onPreviousPage}
              className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>
            <span className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] bg-[#111827] px-2 text-[12px] font-semibold text-white">
              {currentPage}
            </span>
            <button
              type="button"
              onClick={onNextPage}
              disabled={!hasMore || loading || !onNextPage}
              className="flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
