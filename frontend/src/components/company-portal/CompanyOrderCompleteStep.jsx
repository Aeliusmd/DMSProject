"use client";

import Link from "next/link";

export default function CompanyOrderCompleteStep({
  orderNumber,
  loading,
  error,
  receiptUrl,
  hasSubpoena,
  onDownloadSubpoena,
  onDownloadPaymentReceipt,
  downloadingSubpoena,
  downloadingReceipt,
  downloadError,
}) {
  if (loading) {
    return (
      <div className="py-10 text-center text-[13px] text-[#64748B]">
        Confirming your payment...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#16A34A]">
        <SuccessIcon />
      </div>

      <h2 className="text-[24px] font-semibold text-[#0F172A]">
        Order Placed Successfully!
      </h2>
      <p className="mx-auto mt-2 max-w-[420px] text-[13px] text-[#64748B]">
        Your subpoena request has been submitted. Save your order number to
        track the status.
      </p>

      <div className="mx-auto mt-6 max-w-[360px] rounded-[12px] border border-[#D0E8ED] bg-[#E6F7FA] px-5 py-5">
        <p className="text-[12px] font-medium text-[#64748B]">
          Your Order Number
        </p>
        <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#0097B2]">
          {orderNumber || "—"}
        </p>
        <p className="mt-2 text-[11px] text-[#64748B]">
          Use this number to track your request status
        </p>
      </div>

      <div className="mx-auto mt-5 max-w-[420px] rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 text-left">
        <p className="text-[13px] font-semibold text-[#0F172A]">
          Downloads & receipts
        </p>
        <p className="mt-1 text-[12px] text-[#64748B]">
          Download your uploaded subpoena and payment documents for your
          records.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {hasSubpoena ? (
            <button
              type="button"
              onClick={onDownloadSubpoena}
              disabled={downloadingSubpoena}
              className="inline-flex h-10 items-center justify-center rounded-[8px] bg-[#111827] px-4 text-[12px] font-semibold text-white hover:bg-[#1F2937] disabled:opacity-60"
            >
              {downloadingSubpoena
                ? "Downloading..."
                : "Download Uploaded Subpoena"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={onDownloadPaymentReceipt}
            disabled={downloadingReceipt}
            className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-60"
          >
            {downloadingReceipt
              ? "Preparing..."
              : "Download Payment Summary"}
          </button>

          {receiptUrl ? (
            <a
              href={receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#D0E8ED] bg-[#E6F7FA] px-4 text-[12px] font-semibold text-[#0B7C8E] hover:bg-[#D7F1F6]"
            >
              View Stripe Receipt
            </a>
          ) : null}
        </div>

        {downloadError ? (
          <p className="mt-3 text-[12px] text-red-600">{downloadError}</p>
        ) : null}
      </div>

      <div className="mx-auto mt-5 max-w-[420px] rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] px-5 py-4 text-left">
        <p className="text-[13px] font-semibold text-[#B45309]">
          What happens next?
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-[#92400E]">
          <li>We verify the subpoena and facility information</li>
          <li>An invoice is generated and sent to the payee</li>
          <li>Once payment clears, records are released for download</li>
        </ul>
        <p className="mt-3 text-[11px] text-[#A16207]">
          External status values: In Process → Invoice → Paid → Released
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/company-portal/orders/new"
          className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[#0097B2] px-6 text-[13px] font-semibold text-white hover:bg-[#0086A0]"
        >
          Submit Another Subpoena
        </Link>
        <Link
          href="/company-portal/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-white px-6 text-[13px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function SuccessIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7.5 12.5 10.5 15.5 17 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 12.5 8.5 15.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}
