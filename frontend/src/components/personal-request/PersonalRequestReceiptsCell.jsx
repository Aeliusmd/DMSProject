"use client";

import { useState } from "react";
import {
  openPersonalInvoiceReceipt,
  openPersonalPrepaymentReceipt,
} from "@/lib/personal-request/personalPortalAuthApi";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

/**
 * Receipts column:
 * - Prepayment receipt ($35)
 * - Invoice receipt (Stripe) — invoice payment and/or facility fee payment
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

  async function handlePrepaymentReceipt() {
    setError("");
    setBusy("prepayment");
    try {
      await openPersonalPrepaymentReceipt(
        request.id,
        request.prepaymentReceiptUrl || request.receiptUrl
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to open prepayment receipt"));
    } finally {
      setBusy("");
    }
  }

  async function handleInvoiceReceipt() {
    setError("");
    setBusy("invoice");
    try {
      await openPersonalInvoiceReceipt(
        request.id,
        request.invoiceReceiptUrl || request.facilityFeeReceiptUrl
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to open invoice receipt"));
    } finally {
      setBusy("");
    }
  }

  if (!hasPrepayment && !hasInvoiceReceipt) {
    return <span className="text-[#94A3B8]">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col items-start gap-1.5">
        {hasPrepayment ? (
          <button
            type="button"
            onClick={handlePrepaymentReceipt}
            disabled={Boolean(busy)}
            className="text-left font-semibold text-[#0097B2] hover:underline disabled:opacity-60"
          >
            {busy === "prepayment" ? "Opening…" : "Prepayment receipt"}
          </button>
        ) : null}
        {hasInvoiceReceipt ? (
          <button
            type="button"
            onClick={handleInvoiceReceipt}
            disabled={Boolean(busy)}
            className="text-left font-semibold text-[#0097B2] hover:underline disabled:opacity-60"
          >
            {busy === "invoice" ? "Opening…" : "Invoice receipt"}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-[11px] text-[#DC2626]">{error}</p> : null}
    </div>
  );
}
