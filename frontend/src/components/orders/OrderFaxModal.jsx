"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import { getTodayInputDate } from "@/lib/utils/dateUtils";

export default function OrderFaxModal({ isOpen, order, onClose, onConfirm }) {
  const mounted = useIsClient();
  const [faxNumber, setFaxNumber] = useState("");
  const [sentDate, setSentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !order) return;

    setFaxNumber(order.company?.faxNumber || "");
    setSentDate(getTodayInputDate());
    setNotes("");
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

  const handleSubmit = async () => {
    if (!faxNumber.trim()) {
      setError("Fax number is required");
      return;
    }

    if (!sentDate) {
      setError("Date sent is required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onConfirm?.({ faxNumber: faxNumber.trim(), sentDate, notes });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to record fax");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]">
      <section className="w-full max-w-[420px] overflow-hidden rounded-[10px] bg-white shadow-2xl">
        <div className="border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-[14px] font-semibold text-[#111827]">Record Fax</h2>
          <p className="mt-1 text-[11px] text-[#64748B]">
            Order {order.id} • {order.applicant || "N/A"}
          </p>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
              Fax number
            </label>
            <input
              type="text"
              value={faxNumber}
              onChange={(e) => {
                setFaxNumber(e.target.value);
                setError("");
              }}
              placeholder="Enter fax number"
              className="h-[36px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
            />
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
              Date sent
            </label>
            <input
              type="date"
              value={sentDate}
              onChange={(e) => {
                setSentDate(e.target.value);
                setError("");
              }}
              className="h-[36px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
            />
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Fax details..."
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
            disabled={submitting}
            className="h-[34px] rounded-[6px] bg-[#111827] px-4 text-[12px] font-semibold text-white hover:bg-[#1F2937] disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Confirm Fax"}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
