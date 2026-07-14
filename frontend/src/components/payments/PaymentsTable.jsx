"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

function formatDisplayDate(value) {
  if (!value) return "—";

  const datePart = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const [year, month, day] = datePart.split("-");
  return `${month}/${day}/${year}`;
}

function PaymentTypeBadge({ label }) {
  const styles = {
    Regular: "bg-[#E6F7FA] text-[#007F96] border-[#67D8E8]",
    Custodian: "bg-[#F3E8FF] text-[#7C3AED] border-[#DDD6FE]",
    "X-Ray": "bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]",
    Personal: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  };

  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-full border px-3 text-[10px] font-semibold ${
        styles[label] || "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]"
      }`}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Recorded: "bg-[#ECFDF5] text-[#059669]",
    "Pending Review": "bg-[#FEF3C7] text-[#B45309]",
    Succeeded: "bg-[#ECFDF5] text-[#059669]",
    Pending: "bg-[#DBEAFE] text-[#2563EB]",
    Failed: "bg-[#FEE2E2] text-[#DC2626]",
    Paid: "bg-[#ECFDF5] text-[#059669]",
    Partial: "bg-[#DBEAFE] text-[#2563EB]",
    Unpaid: "bg-[#FEE2E2] text-[#DC2626]",
  };

  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-full px-3 text-[10px] font-semibold ${
        styles[status] || "bg-[#F1F5F9] text-[#64748B]"
      }`}
    >
      {status || "—"}
    </span>
  );
}

export default function PaymentsTable({
  payments = [],
  loading = false,
  paymentType = "manual",
}) {
  const router = useRouter();
  const channel = paymentType === "online" ? "online" : "manual";

  if (loading && !payments.length) {
    return (
      <section className="flex min-h-[280px] items-center justify-center rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
        <p className="text-[13px] text-[#94A3B8]">Loading payments...</p>
      </section>
    );
  }

  if (!loading && !payments.length) {
    return (
      <section className="flex min-h-[280px] items-center justify-center rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
        <p className="text-[13px] text-[#94A3B8]">
          No payments found for the selected filters.
        </p>
      </section>
    );
  }

  const handleRowClick = (orderId) => {
    router.push(`/payments/${orderId}?channel=${channel}`);
  };

  return (
    <section className="relative min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
      {loading ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center bg-white/80 py-2">
          <p className="text-[11px] font-medium text-[#64748B]">
            Updating results…
          </p>
        </div>
      ) : null}
      <div className={`h-full overflow-auto ${loading ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[900px] border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Payment Type</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Payment Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Details</th>
            </tr>
          </thead>

          <tbody>
            {payments.map((payment) => (
              <tr
                key={payment.id}
                onClick={() => handleRowClick(payment.orderId)}
                className="cursor-pointer border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#F8FBFC] hover:bg-[#E6F7FA]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/payments/${payment.orderId}?channel=${channel}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[12px] font-semibold text-[#007F96] hover:underline"
                  >
                    {payment.orderNo}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[12px] text-[#334155]">
                  {payment.company}
                </td>
                <td className="px-4 py-3 text-[12px] text-[#334155]">
                  {payment.applicant}
                </td>
                <td className="px-4 py-3">
                  <PaymentTypeBadge label={payment.paymentTypeLabel} />
                </td>
                <td className="px-4 py-3 text-[12px] font-semibold text-[#111827]">
                  {payment.amountDisplay}
                </td>
                <td className="px-4 py-3 text-[12px] text-[#334155]">
                  {formatDisplayDate(payment.paymentDate)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={payment.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[11px] font-semibold text-[#0097B2]">
                    View →
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
