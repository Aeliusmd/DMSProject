"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  markCompanyOrderNoFacility,
  markPersonalOrderNoFacility,
} from "@/lib/orders/orderApi";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

function buildAddFacilityHref(order, portalType = "company") {
  const req = order?.newFacilityRequest || {};
  const params = new URLSearchParams();
  if (order?.dbId) params.set("linkOrderId", String(order.dbId));
  params.set("linkSource", portalType === "personal" ? "personal" : "company");
  if (req.facilityName) params.set("facilityName", req.facilityName);
  if (req.facilityAddress) params.set("address", req.facilityAddress);
  if (req.facilityCity) params.set("city", req.facilityCity);
  if (req.facilityState) params.set("state", req.facilityState);
  if (req.facilityZip) params.set("zip", req.facilityZip);
  return `/facilities/new?${params.toString()}`;
}

function formatAddress(req = {}) {
  const cityStateZip = [
    req.facilityCity,
    [req.facilityState, req.facilityZip].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  return [req.facilityAddress, cityStateZip].filter(Boolean).join(", ");
}

export default function CompanyOrderFacilityModal({
  open,
  order,
  onClose,
  onNoFacility,
  startAtConfirm = false,
  portalType = "company",
}) {
  const router = useRouter();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isPersonal = portalType === "personal";

  useEffect(() => {
    if (!open) return;
    setConfirmEnd(startAtConfirm);
    setSubmitting(false);
    setError("");
  }, [open, startAtConfirm, order?.dbId, portalType]);

  if (!open || !order) return null;

  const req = order.newFacilityRequest || {};
  const feeAmount = Number(req.searchFeeAmount) || 5;

  const handleAddFacility = () => {
    router.push(buildAddFacilityHref(order, portalType));
  };

  const handleConfirmNoFacility = async () => {
    setSubmitting(true);
    setError("");
    try {
      if (isPersonal) {
        await markPersonalOrderNoFacility(order.dbId);
      } else {
        await markCompanyOrderNoFacility(order.dbId);
      }
      onNoFacility?.();
      onClose?.();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update order"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-[12px] bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[#0F172A]">
              Facility not in our system
            </h2>
            <p className="mt-1 text-[12px] text-[#64748B]">
              Order {order.id} — the{" "}
              {isPersonal ? "personal requester" : "external company"} entered a
              facility that is not in our internal system.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[20px] leading-none text-[#94A3B8] hover:text-[#334155]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-[13px]">
          <DetailRow
            label="Facility name"
            value={req.facilityName || "Not provided"}
          />
          <DetailRow label="Address" value={formatAddress(req) || "—"} />
          <DetailRow
            label="Specific doctor"
            value={req.treatingDoctor || "Not provided"}
          />
        </div>

        {!confirmEnd ? (
          <>
            <p className="mt-4 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
              Adding this facility will charge an extra ${feeAmount.toFixed(2)}{" "}
              facility search fee on this order&apos;s invoice.
            </p>

            {error ? (
              <p className="mt-3 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleAddFacility}
                className="inline-flex h-10 items-center justify-center rounded-[8px] bg-[#0097B2] px-4 text-[13px] font-semibold text-white hover:bg-[#0086A0]"
              >
                Add this facility to system
              </button>
              <button
                type="button"
                onClick={() => setConfirmEnd(true)}
                className="text-[12px] font-medium text-red-600 hover:underline"
              >
                Facility couldn&apos;t be found
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4">
            <p className="text-[13px] font-medium text-[#0F172A]">
              Do you want to end this order?
            </p>
            <p className="mt-1 text-[12px] text-[#64748B]">
              This will change the order status to &quot;No facility&quot; and
              stop further processing. No refund will be issued.
            </p>

            {error ? (
              <p className="mt-3 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmEnd(false)}
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#E2E8F0] px-4 text-[13px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmNoFacility}
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center rounded-[8px] bg-red-600 px-4 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {submitting ? "Ending..." : "Yes, end order"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="text-[#64748B]">{label}</span>
      <span className="max-w-[65%] text-right font-medium text-[#0F172A]">
        {value}
      </span>
    </div>
  );
}
