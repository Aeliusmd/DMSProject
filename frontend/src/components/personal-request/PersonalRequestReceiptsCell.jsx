"use client";

import { useState } from "react";
import {
  openPersonalInvoiceReceipt,
  openPersonalPrepaymentReceipt,
} from "@/lib/personal-request/personalPortalAuthApi";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

/**
 * Receipts column:
 * - Prepayment — view label + download icon
 * - Invoice — view label + download icon
 */
export default function PersonalRequestReceiptsCell({ request }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const hasPrepayment =
    Boolean(request?.id) &&
    (Boolean(request?.hasPrepaymentReceipt) ||
      Boolean(request?.prepaymentReceiptUrl) ||
      Boolean(request?.receiptUrl));

  const hasInvoiceReceipt = Boolean(
    request?.id &&
      (request?.hasInvoiceReceipt ||
        request?.canViewInvoice ||
        request?.invoiceReceiptUrl ||
        request?.hasFacilityFeeReceipt ||
        request?.facilityFeeReceiptUrl)
  );

  async function runAction(key, action) {
    setError("");
    setBusy(key);
    try {
      await action();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to open receipt"));
    } finally {
      setBusy("");
    }
  }

  const orderNo =
    request?.confirmationReference ||
    request?.orderNumber ||
    request?.id ||
    "";

  if (!hasPrepayment && !hasInvoiceReceipt) {
    return null;
  }

  return (
    <div className="flex min-w-[148px] flex-col gap-1.5">
      {hasPrepayment ? (
        <ReceiptActionRow
          label="Prepayment"
          busyKeyPrefix="prepayment"
          busy={busy}
          onView={() =>
            runAction("prepayment-view", () =>
              openPersonalPrepaymentReceipt(
                request.id,
                request.prepaymentReceiptUrl || request.receiptUrl,
                { mode: "view", orderNo }
              )
            )
          }
          onDownload={() =>
            runAction("prepayment-download", () =>
              openPersonalPrepaymentReceipt(
                request.id,
                request.prepaymentReceiptUrl || request.receiptUrl,
                { mode: "download", orderNo }
              )
            )
          }
        />
      ) : null}

      {hasInvoiceReceipt ? (
        <ReceiptActionRow
          label="Invoice"
          busyKeyPrefix="invoice"
          busy={busy}
          onView={() =>
            runAction("invoice-view", () =>
              openPersonalInvoiceReceipt(
                request.id,
                request.invoiceReceiptUrl || request.facilityFeeReceiptUrl,
                { mode: "view", orderNo }
              )
            )
          }
          onDownload={() =>
            runAction("invoice-download", () =>
              openPersonalInvoiceReceipt(
                request.id,
                request.invoiceReceiptUrl || request.facilityFeeReceiptUrl,
                { mode: "download", orderNo }
              )
            )
          }
        />
      ) : null}

      {error ? <p className="text-[11px] leading-tight text-[#DC2626]">{error}</p> : null}
    </div>
  );
}

function ReceiptActionRow({ label, busyKeyPrefix, busy, onView, onDownload }) {
  const viewing = busy === `${busyKeyPrefix}-view`;
  const downloading = busy === `${busyKeyPrefix}-download`;
  const disabled = Boolean(busy);

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
      <button
        type="button"
        onClick={onView}
        disabled={disabled}
        title={`View ${label}`}
        className="truncate text-left text-[12px] font-semibold text-[#0097B2] hover:text-[#007F96] hover:underline disabled:cursor-not-allowed disabled:opacity-55"
      >
        {viewing ? "Opening…" : label}
      </button>

      <button
        type="button"
        onClick={onDownload}
        disabled={disabled}
        title={`Download ${label}`}
        aria-label={`Download ${label}`}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-[#B7E4EC] bg-[#E6F7FA] text-[#007F96] transition hover:border-[#0097B2] hover:bg-[#0097B2] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
      >
        {downloading ? <SpinnerIcon /> : <DownloadIcon />}
      </button>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v11"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="m8 10.5 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 18.5h14"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.25"
      />
      <path
        d="M20 12a8 8 0 0 0-8-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
