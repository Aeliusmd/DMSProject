"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";
import { getOrders } from "@/lib/orders/orderApi";
import { resolveRushLabel } from "@/lib/orders/rushUtils";

const RECENT_LIMIT = 8;

export default function DashboardRecentOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getOrders({ limit: RECENT_LIMIT })
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch((err) => {
        if (active) {
          setOrders([]);
          setError(getApiErrorMessage(err, "Failed to load orders"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="min-h-0 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#F1F5F9] px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-[#111827]">
            Recent Orders
          </h2>
          <p className="mt-1 text-[11px] text-[#94A3B8]">
            Last {RECENT_LIMIT} orders from DMS Orders
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

      <div className="max-h-[430px] overflow-auto">
        <table className="w-full min-w-[860px] border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-[#F1F5F9] text-left text-[11px] font-semibold text-[#64748B]">
              <th className="px-4 py-3">Order #</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Subpoena Date</th>
              <th className="px-4 py-3">Rush</th>
              <th className="px-4 py-3">Invoice</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[12px] text-[#94A3B8]"
                >
                  Loading orders...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[12px] font-medium text-red-500"
                >
                  {error}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              orders.map((order) => (
                <tr
                  key={order.dbId || order.id}
                  className="border-b border-[#F8FAFC] last:border-b-0 hover:bg-[#F8FBFC]"
                >
                  <td className="px-4 py-3 align-middle">
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

                  <td className="px-4 py-3 align-middle">
                    <StatusBadge status={order.status} />
                  </td>

                  <td className="px-4 py-3 text-[12px] text-[#334155]">
                    {order.applicant || "—"}
                  </td>

                  <td className="max-w-[160px] truncate px-4 py-3 text-[12px] text-[#334155]">
                    {order.providerName || order.company?.name || "—"}
                  </td>

                  <td className="px-4 py-3 text-[12px] text-[#334155]">
                    {order.subpoenaDateDisplay || order.subpoenaDate || "—"}
                  </td>

                  <td className="px-4 py-3">
                    <RushBadge rush={resolveRushLabel(order)} />
                  </td>

                  <td className="px-4 py-3">
                    <InvoiceBadge status={order.invoiceStatus} />
                  </td>
                </tr>
              ))}

            {!loading && !error && orders.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[12px] text-[#94A3B8]"
                >
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

function RushBadge({ rush }) {
  if (!rush) {
    return <span className="text-[11px] text-[#CBD5E1]">—</span>;
  }

  const styles = {
    "Rush 1": "border-[#FDE68A] bg-[#FEF3C7] text-[#B45309]",
    "Rush 2": "border-[#FDBA74] bg-[#FFEDD5] text-[#EA580C]",
    "Rush 3": "border-[#FCA5A5] bg-[#FEE2E2] text-[#DC2626]",
  };

  return (
    <span
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
