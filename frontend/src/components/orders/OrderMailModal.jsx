"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import { getTodayInputDate } from "@/lib/utils/dateUtils";
import { resolveProviderEmail } from "@/lib/orders/deliveryActions";
import {
  buildOrderMailDefaultBody,
  getOrderRecordsForMail,
} from "@/lib/orders/recordTypeUtils";

export default function OrderMailModal({ isOpen, order, onClose, onSent }) {
  const mounted = useIsClient();
  const [email, setEmail] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const needsEmail = order ? !resolveProviderEmail(order) : true;
  const uploadedRecords = useMemo(() => {
    if (!order) return [];
    return getOrderRecordsForMail(order).filter((slot) => slot.hasFile);
  }, [order]);

  useEffect(() => {
    if (!isOpen || !order) return;

    setEmail(resolveProviderEmail(order) || "");
    setDeliveryDate(getTodayInputDate());
    setMessage(buildOrderMailDefaultBody(order));
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
    if (!deliveryDate) {
      setError("Mail sent date is required");
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError("Email message is required");
      return;
    }

    const trimmed = needsEmail ? email.trim() : resolveProviderEmail(order);

    if (needsEmail && !trimmed) {
      setError("Email is required");
      return;
    }

    if (
      needsEmail &&
      trimmed &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)
    ) {
      setError("Enter a valid email address");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onSent?.({
        email: trimmed,
        deliveryDate,
        message: trimmedMessage,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to send email");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl">
        <div className="shrink-0 border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-[14px] font-semibold text-[#111827]">Mail Records</h2>
          <p className="mt-1 text-[11px] text-[#64748B]">
            Order {order.id} • {order.applicant || "N/A"}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
              Mail sent date
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => {
                setDeliveryDate(e.target.value);
                setError("");
              }}
              className="h-[36px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
            />
            <p className="mt-2 text-[10px] text-[#94A3B8]">
              Saved as ready date and delivery date for this order.
            </p>
          </div>

          {needsEmail && (
            <div>
              <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
                Provider email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="Enter email address"
                className={`h-[36px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none focus:ring-2 ${
                  error
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                    : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
                }`}
              />
            </div>
          )}

          {uploadedRecords.length > 0 && (
            <div className="rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                Attachments
              </p>
              <ul className="mt-1 space-y-0.5">
                {uploadedRecords.map((record) => (
                  <li
                    key={record.recordType}
                    className="text-[11px] font-medium text-[#334155]"
                  >
                    {record.label} PDF
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
              Email message
            </label>
            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setError("");
              }}
              rows={10}
              className="w-full resize-y rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-[12px] leading-[1.5] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
            />
          </div>

          {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E2E8F0] px-5 py-4">
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
            {submitting ? "Sending..." : "Send Mail"}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
