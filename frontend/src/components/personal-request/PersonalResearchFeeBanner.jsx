"use client";

import { useState } from "react";
import { createPersonalResearchFeeCheckout } from "@/lib/personal-request/personalPortalAuthApi";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

export default function PersonalResearchFeeBanner({
  requests = [],
  onPaidRedirect,
}) {
  const due = (requests || []).filter(
    (request) => request?.researchFee?.canPay
  );
  const [payingId, setPayingId] = useState(null);
  const [error, setError] = useState("");

  if (!due.length) return null;

  const handlePay = async (requestId) => {
    setError("");
    setPayingId(requestId);
    try {
      const response = await createPersonalResearchFeeCheckout(requestId);
      const checkoutUrl = response?.data?.checkoutUrl || response?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      setError("Unable to start payment. Please try again.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to start research fee payment"));
    } finally {
      setPayingId(null);
      onPaidRedirect?.();
    }
  };

  return (
    <section className="mb-5 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] p-4 shadow-sm">
      <h2 className="text-[14px] font-semibold text-[#92400E]">
        Facility search fee due
      </h2>
      <p className="mt-1 text-[12px] text-[#A16207]">
        Your invoice has been sent. Pay the facility search fee here while signed
        in — no email link or OTP needed.
      </p>

      {error ? (
        <p className="mt-3 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {error}
        </p>
      ) : null}

      <ul className="mt-3 space-y-2">
        {due.map((request) => (
          <li
            key={request.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#FDE68A] bg-white px-3 py-2.5"
          >
            <div>
              <p className="text-[13px] font-semibold text-[#111827]">
                {request.confirmationReference || `Request #${request.id}`}
              </p>
              <p className="text-[12px] text-[#64748B]">
                Amount due: $
                {request.researchFee?.amountDisplay ||
                  request.researchFee?.amount?.toFixed?.(2) ||
                  "5.00"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handlePay(request.id)}
              disabled={payingId === request.id}
              className="inline-flex h-9 items-center rounded-[8px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0] disabled:opacity-60"
            >
              {payingId === request.id ? "Redirecting..." : "Pay $5.00"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
