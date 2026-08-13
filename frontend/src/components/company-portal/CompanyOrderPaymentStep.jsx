"use client";

import {
  COMPANY_PORTAL_BASE_ORDER_FEE,
  COMPANY_PORTAL_FACILITY_SEARCH_FEE,
  formatFacilityAddressDisplay,
  getRecordTypesSummary,
} from "@/lib/company-portal/companyPortalOrderUtils";

export default function CompanyOrderPaymentStep({
  form,
  fileName,
  amount,
  isEmployee = false,
  walletBalance = null,
  onBack,
  onPay,
  onCancel,
  paying,
  error,
  canceled,
}) {
  const total = Number(amount) || COMPANY_PORTAL_BASE_ORDER_FEE;
  const needsFacilitySearch =
    Boolean(form.requestNewFacilitySearch) ||
    `${form.facilitySelectionMode || ""}`.trim().toLowerCase() === "new";
  const amountDisplay = `$${total.toFixed(2)}`;
  const addressDisplay = formatFacilityAddressDisplay(form);
  const recordsDisplay = getRecordTypesSummary(form);
  const payLabel = `Pay ${amountDisplay} from wallet`;
  const facilityLabel = needsFacilitySearch
    ? form.facilityName || "New facility search"
    : form.facilityName;

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#FFF7ED] text-[#EA580C]">
          <CardIcon />
        </div>
        <div>
          <h2 className="text-[20px] font-semibold text-[#0F172A]">
            Payment Required
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#64748B]">
            This order will be paid from your wallet balance. You will receive
            your order number immediately after payment.
          </p>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] p-5">
        <h3 className="text-[14px] font-semibold text-[#0F172A]">
          Order Summary
        </h3>

        <div className="mt-4 space-y-3 text-[13px]">
          <SummaryRow label="Facility" value={facilityLabel} />
          <SummaryRow label="Address" value={addressDisplay} />
          <SummaryRow label="Records" value={recordsDisplay} />
          <SummaryRow label="Doctor" value={form.treatingDoctor || "—"} />
          <SummaryRow label="Document" value={fileName || "—"} />
        </div>

        <div className="mt-5 space-y-2 border-t border-[#E2E8F0] pt-4 text-[13px]">
          <SummaryRow
            label="Order processing fee"
            value={`$${total.toFixed(2)}`}
          />
          <div className="flex items-center justify-between pt-2">
            <span className="text-[14px] font-semibold text-[#0F172A]">
              Total due now
            </span>
            <span className="text-[18px] font-semibold text-[#0F172A]">
              {amountDisplay}
            </span>
          </div>
        </div>

        {needsFacilitySearch ? (
          <p className="mt-3 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
            You are requesting a search for a facility not in our system. An
            additional ${COMPANY_PORTAL_FACILITY_SEARCH_FEE.toFixed(2)} facility
            search fee will be added to your invoice only if we locate and add
            the facility. It is not charged now.
          </p>
        ) : null}
      </div>

      <div className="mt-5 rounded-[12px] border border-[#E2E8F0] bg-white p-4">
        <p className="text-[13px] font-semibold text-[#0F172A]">
          {isEmployee ? "Employee wallet payment" : "Company wallet payment"}
        </p>
        <p className="mt-1 text-[12px] text-[#64748B]">
          Current wallet balance:
          {" "}
          {walletBalance != null
            ? `$${Number(walletBalance).toFixed(2)}`
            : "Unavailable"}
          . The order total is {amountDisplay}.
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
          {error}
        </p>
      ) : null}

      {canceled ? (
        <p className="mt-4 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-700">
          Payment was canceled. You can try again when ready.
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={paying}
          onClick={onCancel}
          className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-white px-5 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={paying}
          onClick={onBack}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-5 text-[13px] font-medium text-[#334155] hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-60"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={paying}
          onClick={onPay}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[8px] bg-[#0097B2] px-5 text-[13px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:bg-[#0097B2]/45"
        >
          {paying ? "Processing..." : payLabel}
        </button>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#94A3B8]">
        <LockIcon /> Wallet balance will be debited automatically
      </p>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[#64748B]">{label}</span>
      <span className="max-w-[65%] text-right font-medium text-[#0F172A]">
        {value || "—"}
      </span>
    </div>
  );
}

function CardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}
