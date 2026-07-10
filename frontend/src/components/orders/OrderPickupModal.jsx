"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import { getTodayInputDate } from "@/lib/utils/dateUtils";
import { applyApiFieldErrors, getApiErrorMessage } from "@/lib/apiErrorUtils";

export default function OrderPickupModal({ isOpen, order, onClose, onConfirm }) {
  const mounted = useIsClient();
  const [pickupPersonName, setPickupPersonName] = useState("");
  const [pickupDate, setPickupDate] = useState(() => getTodayInputDate());
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !order) return;

    setPickupPersonName("");
    setPickupDate(getTodayInputDate());
    setNotes("");
    setFieldErrors({});
    setError("");
  }, [isOpen, order]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!mounted || !isOpen || !order) return null;

  const isFormInvalid = !pickupPersonName.trim() || !pickupDate;

  const handleSubmit = async () => {
    const nextErrors = {};

    if (!pickupPersonName.trim()) {
      nextErrors.pickupPersonName = "Pickup person name is required";
    }

    if (!pickupDate) {
      nextErrors.pickupDate = "Pickup date is required";
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setError("");
      return;
    }

    setSubmitting(true);
    setError("");
    setFieldErrors({});

    try {
      await onConfirm?.({
        pickupPersonName: pickupPersonName.trim(),
        pickupDate,
        notes,
      });
      onClose();
    } catch (err) {
      const { fieldErrors: apiErrors, message } = applyApiFieldErrors(err);

      if (Object.keys(apiErrors).length > 0) {
        setFieldErrors(apiErrors);
      }

      setError(message || getApiErrorMessage(err, "Failed to record pickup"));
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]">
      <section className="w-full max-w-[420px] overflow-hidden rounded-[10px] bg-white shadow-2xl">
        <div className="border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-[14px] font-semibold text-[#111827]">Record Pickup</h2>
          <p className="mt-1 text-[11px] text-[#64748B]">
            Order {order.id} • {order.applicant || "N/A"}
          </p>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
              Pickup date
            </label>
            <input
              type="date"
              value={pickupDate}
              onChange={(e) => {
                setPickupDate(e.target.value);
                setFieldErrors((prev) => {
                  if (!prev.pickupDate) return prev;
                  const next = { ...prev };
                  delete next.pickupDate;
                  return next;
                });
                setError("");
              }}
              className={`h-[36px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none focus:ring-2 ${
                fieldErrors.pickupDate
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                  : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
              }`}
            />
            {fieldErrors.pickupDate ? (
              <p className="mt-1 text-[11px] text-red-500">{fieldErrors.pickupDate}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
              Pickup person name
            </label>
            <input
              type="text"
              value={pickupPersonName}
              onChange={(e) => {
                setPickupPersonName(e.target.value);
                setFieldErrors((prev) => {
                  if (!prev.pickupPersonName) return prev;
                  const next = { ...prev };
                  delete next.pickupPersonName;
                  return next;
                });
                setError("");
              }}
              placeholder="Enter pickup person name"
              className={`h-[36px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none focus:ring-2 ${
                fieldErrors.pickupPersonName
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                  : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
              }`}
            />
            {fieldErrors.pickupPersonName ? (
              <p className="mt-1 text-[11px] text-red-500">{fieldErrors.pickupPersonName}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Pickup details..."
              className="w-full resize-none rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
            />
          </div>

          {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-[34px] rounded-[6px] px-4 text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || isFormInvalid}
            className="h-[34px] rounded-[6px] bg-[#111827] px-4 text-[12px] font-semibold text-white hover:bg-[#1F2937] disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Confirm Pickup"}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
