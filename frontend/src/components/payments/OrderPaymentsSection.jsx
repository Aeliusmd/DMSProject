"use client";

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

function StatusBadge({ status }) {
  const styles = {
    Recorded: "bg-[#ECFDF5] text-[#059669]",
    "Pending Review": "bg-[#FEF3C7] text-[#B45309]",
    Succeeded: "bg-[#ECFDF5] text-[#059669]",
    Pending: "bg-[#DBEAFE] text-[#2563EB]",
    Failed: "bg-[#FEE2E2] text-[#DC2626]",
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

function DetailItem({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
        {label}
      </p>
      <p
        className={`mt-1 text-[12px] text-[#334155] ${
          mono ? "font-mono text-[11px] break-all" : ""
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function ManualPaymentCard({ payment }) {
  return (
    <article className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PaymentTypeBadge label={payment.typeLabel} />
          <StatusBadge status={payment.status} />
        </div>
        <p className="text-[16px] font-semibold text-[#111827]">
          {payment.amountDisplay}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem label="Payment Date" value={formatDisplayDate(payment.paymentDate)} />
        <DetailItem label="Invoice #" value={payment.invoiceNo} />
        <DetailItem label="Method" value={payment.method} />
        <DetailItem label="Reference #" value={payment.referenceNo} mono />
        <DetailItem label="Recorded By" value={payment.recordedBy} />
        <DetailItem label="Notes" value={payment.notes} />
      </div>
    </article>
  );
}

function OnlinePaymentCard({ payment }) {
  return (
    <article className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PaymentTypeBadge label={payment.typeLabel} />
          <StatusBadge status={payment.status} />
        </div>
        <p className="text-[16px] font-semibold text-[#111827]">
          {payment.amountDisplay}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem
          label="Transaction Date"
          value={formatDisplayDate(payment.transactionDate)}
        />
        <DetailItem label="Invoice #" value={payment.invoiceNo} />
        <DetailItem label="Payment Method" value={payment.paymentMethod} />
        <DetailItem label="Customer" value={payment.customerName} />
        <DetailItem label="Customer Email" value={payment.customerEmail} />
        <DetailItem
          label="Card"
          value={
            payment.cardLast4
              ? `${payment.cardBrand || "Card"} •••• ${payment.cardLast4}`
              : payment.achBankName
                ? `${payment.achBankName} •••• ${payment.achLast4}`
                : "—"
          }
        />
        <DetailItem
          label="Stripe Payment ID"
          value={payment.stripePaymentId}
          mono
        />
        <DetailItem
          label="Stripe Charge ID"
          value={payment.stripeChargeId}
          mono
        />
        <DetailItem
          label="Stripe Customer ID"
          value={payment.stripeCustomerId}
          mono
        />
        <DetailItem label="Currency" value={payment.currency?.toUpperCase()} />
        <DetailItem label="Processing Fee" value={payment.processingFeeDisplay} />
        <DetailItem label="Net Amount" value={payment.netAmountDisplay} />
        {payment.failureMessage ? (
          <DetailItem label="Failure Reason" value={payment.failureMessage} />
        ) : null}
        {payment.receiptUrl ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
              Receipt
            </p>
            <a
              href={payment.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-[12px] font-semibold text-[#007F96] hover:underline"
            >
              View Stripe Receipt
            </a>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function OrderPaymentsSection({
  manualPayments = [],
  onlinePayments = [],
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
          <div className="border-b border-[#E2E8F0] px-5 py-4">
            <h2 className="text-[14px] font-semibold text-[#111827]">
              Manual Payments
            </h2>
            <p className="mt-1 text-[12px] text-[#64748B]">
              Staff-recorded payments including check, cash, and wire transfers.
            </p>
          </div>

          <div className="space-y-3 p-5">
            {manualPayments.length ? (
              manualPayments.map((payment) => (
                <ManualPaymentCard key={payment.id} payment={payment} />
              ))
            ) : (
              <p className="text-[12px] text-[#94A3B8]">
                No manual payments recorded for this order.
              </p>
            )}
          </div>
        </section>

      <section className="rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
          <div className="border-b border-[#E2E8F0] px-5 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[14px] font-semibold text-[#111827]">
                  Online Payments (Stripe)
                </h2>
                <p className="mt-1 text-[12px] text-[#64748B]">
                  Card and ACH transactions with Stripe gateway details.
                </p>
              </div>
              <span className="inline-flex h-[24px] items-center rounded-full bg-[#E6F7FA] px-3 text-[10px] font-semibold text-[#007F96]">
                Stripe Gateway
              </span>
            </div>
          </div>

          <div className="space-y-3 p-5">
            {onlinePayments.length ? (
              onlinePayments.map((payment) => (
                <OnlinePaymentCard key={payment.id} payment={payment} />
              ))
            ) : (
              <p className="text-[12px] text-[#94A3B8]">
                No online payments recorded for this order.
              </p>
            )}
          </div>
        </section>
    </div>
  );
}
