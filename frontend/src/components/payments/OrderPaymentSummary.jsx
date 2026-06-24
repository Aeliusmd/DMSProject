"use client";

export default function OrderPaymentSummary({ totals }) {
  if (!totals) return null;

  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-5 shadow-sm">
      <h2 className="mb-4 text-[13px] font-semibold text-[#334155]">
        Order Payment Summary
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Total Invoiced"
          value={totals.invoicedDisplay}
          tone="default"
        />
        <SummaryCard
          label="Total Paid"
          value={totals.paidDisplay}
          tone="green"
        />
        <SummaryCard
          label="Total Due"
          value={totals.dueDisplay}
          tone={totals.due > 0 ? "red" : "default"}
        />
      </div>
    </section>
  );
}

function SummaryCard({ label, value, tone = "default" }) {
  const valueClass =
    tone === "green"
      ? "text-[#059669]"
      : tone === "red"
        ? "text-red-500"
        : "text-[#111827]";

  return (
    <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4">
      <p className="text-[11px] font-medium text-[#64748B]">{label}</p>
      <p className={`mt-2 text-[22px] font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}
