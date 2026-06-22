"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import { resolveProviderEmail } from "@/lib/orders/deliveryActions";
import { SHEET_COMPANY_INFO } from "@/lib/sheetTemplateConstants";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SendCopyLetterModal({
  isOpen,
  order,
  onClose,
  onSent,
}) {
  const mounted = useIsClient();
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [additionalEmails, setAdditionalEmails] = useState([""]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const preview = useMemo(() => {
    if (!order) return null;

    const facilityName =
      order.facilityInfo?.name || order.facilityName || "Facility";
    const facilityAddress =
      order.facilityInfo?.address || order.facilityName || "";

    return {
      facilityName,
      facilityAddress,
      applicant: order.applicant || "N/A",
      orderNumber: order.id || order.orderNo || "N/A",
    };
  }, [order]);

  useEffect(() => {
    if (!isOpen || !order) return;

    setPrimaryEmail(resolveProviderEmail(order) || "");
    setAdditionalEmails([""]);
    setError("");
    setSuccessMessage("");
  }, [isOpen, order]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!mounted || !isOpen || !order || !preview) return null;

  const handleAdditionalEmailChange = (index, value) => {
    setAdditionalEmails((prev) =>
      prev.map((email, itemIndex) => (itemIndex === index ? value : email))
    );
    setError("");
  };

  const handleAddEmail = () => {
    setAdditionalEmails((prev) => [...prev, ""]);
  };

  const handleRemoveEmail = (index) => {
    setAdditionalEmails((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async () => {
    const trimmedPrimary = primaryEmail.trim();

    if (!trimmedPrimary) {
      setError("Company email is required");
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedPrimary)) {
      setError("Enter a valid company email address");
      return;
    }

    const extras = additionalEmails
      .map((email) => email.trim())
      .filter(Boolean);

    for (const email of extras) {
      if (!EMAIL_PATTERN.test(email)) {
        setError(`Invalid additional email: ${email}`);
        return;
      }
    }

    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await onSent?.({
        email: trimmedPrimary,
        additionalEmails: extras,
      });

      const recipientCount = result?.recipients?.length || 1;
      setSuccessMessage(
        `Copy service letter sent successfully to ${recipientCount} recipient${
          recipientCount === 1 ? "" : "s"
        }. It expires 7 days from today.`
      );

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      setError(err.message || "Failed to send copy service letter");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[calc(100vh-42px)] w-full max-w-[560px] flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl">
        <div className="border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-[14px] font-semibold text-[#111827]">
            Send Copy/Letter
          </h2>
          <p className="mt-1 text-[11px] text-[#64748B]">
            Order {preview.orderNumber} • {preview.applicant}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-[11px] leading-[18px] text-[#475569]">
            <p className="font-semibold text-[#111827]">{preview.facilityName}</p>
            {preview.facilityAddress ? <p>{preview.facilityAddress}</p> : null}
            <p className="mt-2">
              <span className="font-semibold">Re:</span> {preview.applicant}
            </p>
            <p>
              <span className="font-semibold">Reference No:</span>{" "}
              {preview.orderNumber}
            </p>
            <p className="mt-2 text-[#64748B]">
              A PDF copy service letter from {SHEET_COMPANY_INFO.companyName} will
              be attached. The letter expires 7 days after sending.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
              Company email
            </label>
            <input
              type="email"
              value={primaryEmail}
              onChange={(e) => {
                setPrimaryEmail(e.target.value);
                setError("");
              }}
              placeholder="company@example.com"
              className="h-[36px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-[11px] font-semibold text-[#475569]">
                Additional emails (optional)
              </label>
              <button
                type="button"
                onClick={handleAddEmail}
                className="text-[11px] font-semibold text-[#007F96] hover:underline"
              >
                + Add email
              </button>
            </div>

            <div className="space-y-2">
              {additionalEmails.map((email, index) => (
                <div key={`extra-email-${index}`} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) =>
                      handleAdditionalEmailChange(index, e.target.value)
                    }
                    placeholder="additional@example.com"
                    className="h-[36px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
                  />
                  {additionalEmails.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(index)}
                      className="shrink-0 text-[11px] font-semibold text-[#94A3B8] hover:text-red-500"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
          {successMessage ? (
            <p className="rounded-[6px] border border-[#86EFAC] bg-[#ECFDF5] px-3 py-2 text-[11px] font-medium text-[#059669]">
              {successMessage}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-[34px] rounded-[6px] px-4 text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || Boolean(successMessage)}
            className="h-[34px] rounded-[6px] bg-[#111827] px-4 text-[12px] font-semibold text-white hover:bg-[#1F2937] disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send"}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
