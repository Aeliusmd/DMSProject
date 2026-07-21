"use client";

import { useState } from "react";
import PersonalRecordsDownloadButton from "@/components/personal-request/PersonalRecordsDownloadButton";
import {
  createPersonalInvoiceCheckout,
  createPersonalResearchFeeCheckout,
} from "@/lib/personal-request/personalPortalAuthApi";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

const actionBtnBase =
  "inline-flex h-[32px] min-w-[132px] items-center justify-center rounded-[6px] px-3 text-[11px] font-semibold text-white disabled:opacity-60";

const downloadBtnClass = `${actionBtnBase} bg-[#16A34A] hover:bg-[#15803D]`;

const payBtnClass = `${actionBtnBase} bg-[#D97706] hover:bg-[#B45309]`;

const facilityFeeBtnClass = `${actionBtnBase} bg-[#0097B2] hover:bg-[#0086A0]`;

/**
 * Action column pay buttons use logged-in Stripe Checkout
 * (no emailed /pay link or email OTP required).
 */
export default function PersonalRequestActionsCell({ request }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const canDownload = Boolean(
    request?.canDownload && (request?.downloadToken || request?.downloadUrl)
  );
  const canPayInvoice = Boolean(request?.canPayInvoice && request?.id);
  const canPayFacilityFee = Boolean(
    request?.id && request?.researchFee?.canPay
  );
  const facilityFeeLabel = `Pay facility fee $${
    request?.researchFee?.amountDisplay ||
    request?.researchFee?.amount?.toFixed?.(2) ||
    "5.00"
  }`;

  async function startCheckout(kind, checkoutFn) {
    setError("");
    setBusy(kind);
    try {
      const response = await checkoutFn(request.id);
      const checkoutUrl = response?.data?.checkoutUrl || response?.checkoutUrl;
      if (!checkoutUrl) {
        throw new Error("Checkout URL missing");
      }
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          kind === "invoice"
            ? "Unable to start invoice payment"
            : "Unable to start facility fee payment"
        )
      );
      setBusy("");
    }
  }

  if (!canDownload && !canPayInvoice && !canPayFacilityFee) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {canDownload ? (
          <PersonalRecordsDownloadButton
            downloadToken={request.downloadToken}
            downloadUrl={request.downloadUrl}
            label="Download Records"
            className={downloadBtnClass}
          />
        ) : null}
        {canPayFacilityFee ? (
          <button
            type="button"
            onClick={() =>
              startCheckout("facility", createPersonalResearchFeeCheckout)
            }
            disabled={Boolean(busy)}
            className={facilityFeeBtnClass}
          >
            {busy === "facility" ? "Redirecting…" : facilityFeeLabel}
          </button>
        ) : null}
        {canPayInvoice ? (
          <button
            type="button"
            onClick={() =>
              startCheckout("invoice", createPersonalInvoiceCheckout)
            }
            disabled={Boolean(busy)}
            className={payBtnClass}
          >
            {busy === "invoice" ? "Redirecting…" : "Pay Invoice"}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-[11px] text-[#DC2626]">{error}</p> : null}
    </div>
  );
}
