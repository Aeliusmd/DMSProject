"use client";

function formatDisplayDate(value) {
  if (!value) return "—";

  const datePart = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return value;

  const [year, month, day] = datePart.split("-");
  return `${month}/${day}/${year}`;
}

function InvoiceStatusBadge({ status }) {
  const styles = {
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
      {status}
    </span>
  );
}

function PaymentTypeBadge({ label }) {
  const styles = {
    Regular: "bg-[#E6F7FA] text-[#007F96] border-[#67D8E8]",
    Custodian: "bg-[#F3E8FF] text-[#7C3AED] border-[#DDD6FE]",
    "X-Ray": "bg-[#FFEDD5] text-[#EA580C] border-[#FDBA74]",
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

export default function OrderInvoicesSection({ invoices = [] }) {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
      <div className="border-b border-[#E2E8F0] px-5 py-4">
        <h2 className="text-[14px] font-semibold text-[#111827]">Invoices</h2>
        <p className="mt-1 text-[12px] text-[#64748B]">
          All invoices for this order with amounts, sent dates, paid, and due
          balances.
        </p>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[920px] border-collapse">
          <thead>
            <tr className="border-b border-[#F1F5F9] text-left text-[11px] font-semibold text-[#475569]">
              <th className="px-5 py-3">Invoice #</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Invoice Date</th>
              <th className="px-5 py-3">Last Sent</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Paid</th>
              <th className="px-5 py-3">Due</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr
                key={invoice.id}
                className="border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#F8FBFC]"
              >
                <td className="px-5 py-3 text-[12px] font-semibold text-[#007F96]">
                  {invoice.invoiceNo}
                </td>
                <td className="px-5 py-3">
                  <PaymentTypeBadge label={invoice.typeLabel} />
                </td>
                <td className="px-5 py-3 text-[12px] text-[#334155]">
                  {formatDisplayDate(invoice.invoiceDate)}
                </td>
                <td className="px-5 py-3 text-[12px] text-[#334155]">
                  {formatDisplayDate(invoice.lastSentDate)}
                </td>
                <td className="px-5 py-3 text-[12px] font-semibold text-[#111827]">
                  {invoice.amountDisplay}
                </td>
                <td className="px-5 py-3 text-[12px] font-medium text-[#059669]">
                  {invoice.paidDisplay}
                </td>
                <td className="px-5 py-3 text-[12px] font-medium text-red-500">
                  {invoice.dueDisplay}
                </td>
                <td className="px-5 py-3">
                  <InvoiceStatusBadge status={invoice.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
