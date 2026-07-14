"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import { resolveProviderEmail } from "@/lib/orders/deliveryActions";
import { getOrderRecordsForMail } from "@/lib/orders/recordTypeUtils";
import { applyApiFieldErrors, getApiErrorMessage } from "@/lib/apiErrorUtils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmails(primaryEmail, additionalEmails = []) {
  const seen = new Set();
  const emails = [];

  [primaryEmail, ...additionalEmails].forEach((value) => {
    const trimmed = `${value || ""}`.trim();
    if (!trimmed) return;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    emails.push(trimmed);
  });

  return emails;
}

export default function SendInvoiceEmailModal({
  isOpen,
  order,
  mode = "send",
  invoiceKind = "standard",
  onClose,
  onSend,
}) {
  const mounted = useIsClient();
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [additionalEmails, setAdditionalEmails] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isXray = invoiceKind === "xray";
  const isRecords =
    invoiceKind === "records" || invoiceKind === "companyPortalRecords";
  const isCnr = invoiceKind === "cnr";
  const isCertification = invoiceKind === "certification";
  const isResend = mode === "resend";
  const title = isCertification
    ? "Send Certificate of Records"
    : isCnr
    ? isResend
      ? "Email CNR Record"
      : "Send CNR Record"
    : isRecords
      ? "Email Records"
      : isXray
        ? isResend
          ? "Email X-Ray Invoice"
          : "Send X-Ray Invoice"
        : isResend
          ? "Email Invoice"
          : "Send Invoice";
  const submitLabel = isCnr || isCertification
    ? "Send Email"
    : isRecords
      ? "Send Email"
      : isXray
        ? isResend
          ? "Send Email"
          : "Send X-Ray Invoice"
        : isResend
          ? "Send Email"
          : "Send Invoice";
  const helpText = isCertification
    ? "The company email is filled in automatically and can be changed before sending. Use Add another email to send the certificate of records to additional recipients in one step."
    : isCnr
    ? "The company email is filled in automatically and can be changed before sending. Use Add another email to send the CNR letter and reason to additional recipients in one step."
    : isRecords
    ? "The company email is filled in automatically and can be changed before sending. Use Add another email to send the same secure download link to additional recipients. The link expires 7 days after it is sent."
    : isXray
      ? "The company email is filled in automatically and can be changed before sending the X-Ray invoice. Use Add another email to send the same X-Ray invoice to additional recipients in one step."
      : "The company email is filled in automatically and can be changed before sending. Use Add another email to send the same invoice to additional recipients in one step.";

  useEffect(() => {
    if (!isOpen || !order) return;

    setPrimaryEmail(resolveProviderEmail(order) || "");
    setAdditionalEmails([]);
    setFieldErrors({});
    setError("");
    setSubmitting(false);
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

  const isFormInvalid =
    !primaryEmail.trim() || !EMAIL_PATTERN.test(primaryEmail.trim());

  const uploadedRecords = isRecords
    ? getOrderRecordsForMail(order).filter((slot) => slot.hasFile)
    : [];

  const handleAddEmail = () => {
    setAdditionalEmails((prev) => [...prev, ""]);
  };

  const handleAdditionalChange = (index, value) => {
    setAdditionalEmails((prev) =>
      prev.map((email, emailIndex) => (emailIndex === index ? value : email))
    );
    setFieldErrors({});
    setError("");
  };

  const handleRemoveAdditional = (index) => {
    setAdditionalEmails((prev) => prev.filter((_, emailIndex) => emailIndex !== index));
    setError("");
  };

  const handleSubmit = async () => {
    const emails = normalizeEmails(primaryEmail, additionalEmails);
    const nextErrors = {};

    if (!emails.length) {
      nextErrors.email = "Enter at least one email address";
    } else {
      const invalidEmail = emails.find((email) => !EMAIL_PATTERN.test(email));
      if (invalidEmail) {
        setError(`Enter a valid email address: ${invalidEmail}`);
        return;
      }
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
      await onSend?.(emails);
      onClose();
    } catch (err) {
      const { fieldErrors: apiErrors, message } = applyApiFieldErrors(err, {
        emails: "email",
      });

      if (Object.keys(apiErrors).length > 0) {
        setFieldErrors(apiErrors);
      }

      setError(
        message ||
          getApiErrorMessage(
            err,
            `Failed to send ${isCertification ? "certificate of records " : isCnr ? "CNR " : isRecords ? "records" : isXray ? "X-Ray " : ""}email`
          )
      );
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl">
        <div className="shrink-0 border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-[14px] font-semibold text-[#111827]">{title}</h2>
          <p className="mt-1 text-[11px] text-[#64748B]">
            Order {order.id} • {order.applicant || "N/A"}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[11px] leading-relaxed text-[#475569]">
            {helpText}
          </div>

          {isCnr && order.cnrReason ? (
            <div className="rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                CNR Reason
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[11px] font-medium text-[#334155]">
                {order.cnrReason}
              </p>
            </div>
          ) : null}

          {isRecords && uploadedRecords.length > 0 && (
            <div className="rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                Records in download link
              </p>
              <ul className="mt-1 space-y-0.5">
                {uploadedRecords.map((record) => (
                  <li
                    key={record.recordType}
                    className="text-[11px] font-medium text-[#334155]"
                  >
                    {record.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
              Company email
            </label>
            <input
              type="email"
              value={primaryEmail}
              onChange={(e) => {
                setPrimaryEmail(e.target.value);
                setFieldErrors({});
                setError("");
              }}
              placeholder="Enter company email"
              className={`h-[36px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none focus:ring-2 ${
                fieldErrors.email || error
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                  : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
              }`}
            />
            {fieldErrors.email ? (
              <p className="mt-1 text-[11px] text-red-500">{fieldErrors.email}</p>
            ) : null}
          </div>

          {additionalEmails.map((email, index) => (
            <div key={`additional-email-${index}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-[11px] font-semibold text-[#475569]">
                  Additional email {index + 1}
                </label>
                <button
                  type="button"
                  onClick={() => handleRemoveAdditional(index)}
                  className="text-[11px] font-semibold text-[#94A3B8] hover:text-red-500"
                >
                  Remove
                </button>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => handleAdditionalChange(index, e.target.value)}
                placeholder="Enter additional email"
                className="h-[36px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddEmail}
            className="text-[12px] font-semibold text-[#007F96] underline"
          >
            + Add another email
          </button>

          {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E2E8F0] px-5 py-4">
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
            disabled={submitting || isFormInvalid}
            className="h-[34px] rounded-[6px] bg-[#111827] px-4 text-[12px] font-semibold text-white hover:bg-[#1F2937] disabled:opacity-60"
          >
            {submitting ? "Sending..." : submitLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
