"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import { createOrderNote } from "@/lib/orders/orderApi";
import { validateNoteForm } from "@/lib/orders/orderNoteUtils";
import OrderNoteFormFields from "@/components/orders/OrderNoteFormFields";
import { applyApiFieldErrors, getApiErrorMessage, hasValidationErrors } from "@/lib/apiErrorUtils";

export default function OrderAddNoteModal({ isOpen, order, onClose, onSaved }) {
  const mounted = useIsClient();
  const [noteText, setNoteText] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const orderId = order?.dbId ?? order?.id ?? null;

  useEffect(() => {
    if (!isOpen) return;
    setNoteText("");
    setCallbackDate("");
    setAttachment(null);
    setErrors({});
  }, [isOpen, orderId]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const noteValidationErrors = useMemo(
    () =>
      validateNoteForm({
        noteText,
        callbackDate,
        attachment,
      }),
    [noteText, callbackDate, attachment]
  );

  const isNoteInvalid = hasValidationErrors(noteValidationErrors);

  if (!mounted || !isOpen || !order) return null;

  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSave = async () => {
    const nextErrors = validateNoteForm({
      noteText,
      callbackDate,
      attachment,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await createOrderNote(orderId, {
        note: noteText.trim(),
        callbackDate,
        attachment,
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      const { fieldErrors, message } = applyApiFieldErrors(err, {
        note: "noteText",
        file: "attachment",
      });

      setErrors((prev) => ({
        ...prev,
        ...fieldErrors,
        ...(Object.keys(fieldErrors).length === 0
          ? { noteText: getApiErrorMessage(err, "Failed to save note") }
          : {}),
      }));

      if (message && Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, submit: message }));
      }
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[calc(100vh-44px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[8px] bg-white shadow-2xl">
        <ModalHeader order={order} title="Add New Note" onClose={onClose} />

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <OrderNoteFormFields
            noteText={noteText}
            callbackDate={callbackDate}
            attachment={attachment}
            errors={errors}
            onNoteTextChange={(value) => {
              setNoteText(value);
              clearError("noteText");
            }}
            onCallbackDateChange={(value) => {
              setCallbackDate(value);
              clearError("callbackDate");
            }}
            onAttachmentChange={(file) => {
              setAttachment(file);
              clearError("attachment");
            }}
          />

          <div className="mt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || isNoteInvalid}
              className="inline-flex h-[32px] items-center justify-center rounded-[6px] bg-[#0097B2] px-4 text-[11px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Note"}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}

function ModalHeader({ order, title, onClose }) {
  return (
    <div className="flex h-[48px] shrink-0 items-start justify-between border-b border-[#E2E8F0] px-5 py-3">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold text-[#111827]">
          {title} — {order.id}
        </h2>
        <p className="mt-[3px] truncate text-[10px] text-[#007F96]">
          {order.applicant}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex h-[24px] w-[24px] items-center justify-center rounded-[5px] text-[16px] leading-none text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155]"
        aria-label="Close modal"
      >
        ×
      </button>
    </div>
  );
}
