"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDashboardStats } from "@/lib/dashboard/dashboardApi";

export default function DashboardFinancialSummary() {
  const [financial, setFinancial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getDashboardStats()
      .then((stats) => {
        if (active) setFinancial(stats?.financial || null);
      })
      .catch((err) => {
        if (active) {
          setFinancial(null);
          setError(err.message || "Failed to load financial summary");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const items = useMemo(() => {
    if (!financial) return [];

    return [
      {
        label: "Total Invoiced",
        value: financial.totalInvoicedDisplay,
        color: "text-[#111827]",
      },
      {
        label: "Total Paid",
        value: financial.totalPaidDisplay,
        color: "text-[#059669]",
      },
      {
        label: "Outstanding",
        value: financial.outstandingDisplay,
        color: "text-[#EA580C]",
      },
      {
        label: "Overdue Invoices",
        value: String(financial.overdueInvoices ?? 0),
        color: "text-red-500",
      },
      {
        label: "Needs Resend",
        value: String(financial.needsResend ?? 0),
        color: "text-[#EA580C]",
      },
    ];
  }, [financial]);

  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
      <h2 className="mb-4 text-[13px] font-semibold text-[#111827]">
        Financial Summary
      </h2>

      {error && (
        <p className="mb-3 text-[12px] font-medium text-red-500">{error}</p>
      )}

      <div className="space-y-4">
        {(loading ? PLACEHOLDER_ITEMS : items).map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-[12px] text-[#64748B]">{item.label}</span>
            <span className={`text-[13px] font-semibold ${item.color}`}>
              {loading ? "…" : item.value}
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/invoices"
        className="mt-4 block text-center text-[12px] font-semibold text-[#0097B2] hover:underline"
      >
        View Outstanding Invoices
      </Link>
    </section>
  );
}

const PLACEHOLDER_ITEMS = [
  { label: "Total Invoiced", color: "text-[#111827]" },
  { label: "Total Paid", color: "text-[#059669]" },
  { label: "Outstanding", color: "text-[#EA580C]" },
  { label: "Overdue Invoices", color: "text-red-500" },
  { label: "Needs Resend", color: "text-[#EA580C]" },
];
