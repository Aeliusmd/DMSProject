"use client";

import { useState } from "react";
import PersonalRecordsDownloadButton from "@/components/personal-request/PersonalRecordsDownloadButton";
import {
  createPersonalInvoiceCheckout,
  createPersonalResearchFeeCheckout,
} from "@/lib/personal-request/personalPortalAuthApi";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

const downloadBtnClass =
  "inline-flex h-[30px] items-center justify-center rounded-[6px] bg-[#16A34A] px-3 text-[11px] font-semibold text-white hover:bg-[#15803D] disabled:opacity-60";

const payBtnClass =
  "inline-flex h-[30px] items-center justify-center rounded-[6px] bg-[#D97706] px-3 text-[11px] font-semibold text-white hover:bg-[#B45309] disabled:opacity-60";

const facilityFeeBtnClass =
  "inline-flex h-[30px] items-center justify-center rounded-[6px] bg-[#0097B2] px-3 text-[11px] font-semibold text-white hover:bg-[#0086A0] disabled:opacity-60";

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
    return <span className="text-[#94A3B8]">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {canDownload ? (
          <PersonalRecordsDownloadButton
            downloadToken={request.downloadToken}
            downloadUrl={request.downloadUrl}
            label="Download records"
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
            {busy === "invoice" ? "Redirecting…" : "Pay invoice"}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-[11px] text-[#DC2626]">{error}</p> : null}
    </div>
  );
}
