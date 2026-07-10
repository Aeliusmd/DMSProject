"use client";

import { useEffect, useMemo, useState } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function OrderCancelModal({
  open,
  order,
  loading = false,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState("");
  const [step, setStep] = useState("reason");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");

  const isReasonInvalid = useMemo(() => !reason.trim(), [reason]);

  useEffect(() => {
    if (open) {
      setReason("");
      setStep("reason");
      setFieldErrors({});
      setError("");
    }
  }, [open, order?.dbId]);

  if (!open) return null;

  if (step === "confirm") {
    return (
      <ConfirmModal
        open
        title="Cancel Order"
        message={`Are you sure you want to cancel order ${order?.id || ""}?`}
        variant="warning"
        confirmLabel={loading ? "Cancelling..." : "Confirm"}
        cancelLabel="Back"
        confirmDisabled={loading}
        onCancel={() => setStep("reason")}
        onConfirm={() => {
          if (loading) return;
          onConfirm(reason);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]">
      <section
        className="rounded-[9px] bg-white px-5 py-5 shadow-2xl"
        style={{ width: "100%", maxWidth: "420px" }}
      >
        <h2 className="text-[15px] font-semibold text-[#111827]">Cancel Order</h2>
        <p className="mt-2 text-[12px] leading-[20px] text-[#475569]">
          Please provide a reason for cancelling order{" "}
          <span className="font-semibold text-[#111827]">{order?.id || ""}</span>.
        </p>

        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setFieldErrors({});
            if (error) setError("");
          }}
          rows={4}
          placeholder="Enter cancellation reason..."
          className={`mt-4 w-full resize-none rounded-[6px] border px-3 py-2 text-[12px] text-[#334155] outline-none focus:ring-2 ${
            fieldErrors.reason
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
              : "border-[#E2E8F0] focus:border-[#007F96] focus:ring-[#007F96]/10"
          }`}
        />

        {fieldErrors.reason ? (
          <p className="mt-2 text-[11px] font-medium text-red-500">{fieldErrors.reason}</p>
        ) : null}

        {error ? (
          <p className="mt-2 text-[11px] font-medium text-red-500">{error}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-[34px] rounded-[6px] bg-[#F8FAFC] px-4 text-[12px] font-semibold text-[#334155] hover:bg-[#E2E8F0]"
          >
            Close
          </button>

          <button
            type="button"
            onClick={() => {
              if (!reason.trim()) {
                setFieldErrors({ reason: "Cancellation reason is required." });
                setError("");
                return;
              }
              setFieldErrors({});
              setStep("confirm");
            }}
            disabled={isReasonInvalid}
            className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: "#F59E0B" }}
          >
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}
