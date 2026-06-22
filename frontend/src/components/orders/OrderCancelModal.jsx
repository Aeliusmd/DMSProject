"use client";

import { useEffect, useState } from "react";
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
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setStep("reason");
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
            if (error) setError("");
          }}
          rows={4}
          placeholder="Enter cancellation reason..."
          className="mt-4 w-full resize-none rounded-[6px] border border-[#E2E8F0] px-3 py-2 text-[12px] text-[#334155] outline-none focus:border-[#007F96]"
        />

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
                setError("Cancellation reason is required.");
                return;
              }
              setStep("confirm");
            }}
            className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] px-4 text-[12px] font-semibold text-white"
            style={{ backgroundColor: "#F59E0B" }}
          >
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}
