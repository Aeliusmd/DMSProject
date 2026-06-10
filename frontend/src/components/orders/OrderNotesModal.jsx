"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const MAX_NOTE_LENGTH = 1000;
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function OrderNotesModal({ isOpen, order, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [errors, setErrors] = useState({});
  const [history, setHistory] = useState([]);

  const defaultNoteHistory = useMemo(() => {
    if (!order) return [];

    return [
      {
        date: "06/02/2026 10:45 AM",
        by: "John Smith",
        note: "Called - 06/02/2026 10:45 AM",
      },
      {
        date: "05/28/2026 2:15 PM",
        by: "John Smith",
        note: "Called - 05/28/2026 2:15 PM",
      },
    ];
  }, [order]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    setNoteText("");
    setCallbackDate("");
    setAttachment(null);
    setErrors({});
    setHistory(defaultNoteHistory);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, defaultNoteHistory]);

  if (!mounted || !isOpen || !order) return null;

  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;

      const updatedErrors = { ...prev };
      delete updatedErrors[field];
      return updatedErrors;
    });
  };

  const validateNote = () => {
    const newErrors = {};
    const trimmedNote = noteText.trim();

    if (!trimmedNote) {
      newErrors.noteText = "Note text is required.";
    }

    if (trimmedNote.length > MAX_NOTE_LENGTH) {
      newErrors.noteText = `Note cannot be more than ${MAX_NOTE_LENGTH} characters.`;
    }

    if (callbackDate) {
      const selectedDate = new Date(callbackDate);
      const today = new Date();

      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        newErrors.callbackDate = "Callback date cannot be in the past.";
      }
    }

    if (attachment) {
      const fileSizeMb = attachment.size / (1024 * 1024);

      if (!ALLOWED_FILE_TYPES.includes(attachment.type)) {
        newErrors.attachment =
          "Only PDF, Word, JPG, and PNG files are allowed.";
      }

      if (fileSizeMb > MAX_FILE_SIZE_MB) {
        newErrors.attachment = `File size must be less than ${MAX_FILE_SIZE_MB} MB.`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateCallbackOnly = () => {
    const newErrors = {};

    if (callbackDate) {
      const selectedDate = new Date(callbackDate);
      const today = new Date();

      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        newErrors.callbackDate = "Callback date cannot be in the past.";
      }
    }

    if (attachment) {
      const fileSizeMb = attachment.size / (1024 * 1024);

      if (!ALLOWED_FILE_TYPES.includes(attachment.type)) {
        newErrors.attachment =
          "Only PDF, Word, JPG, and PNG files are allowed.";
      }

      if (fileSizeMb > MAX_FILE_SIZE_MB) {
        newErrors.attachment = `File size must be less than ${MAX_FILE_SIZE_MB} MB.`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveNote = () => {
    if (!validateNote()) return;

    const now = new Date().toLocaleString();

    const payload = {
      orderId: order.id,
      applicant: order.applicant,
      noteText: noteText.trim(),
      callbackDate,
      attachment,
      type: "note",
    };

    console.log("Save order note:", payload);

    setHistory((prev) => [
      {
        date: now,
        by: "John Smith",
        note: noteText.trim(),
      },
      ...prev,
    ]);

    setNoteText("");
    setCallbackDate("");
    setAttachment(null);
    setErrors({});
  };

  const handleCalled = () => {
    if (!validateCallbackOnly()) return;

    const now = new Date().toLocaleString();
    const calledNote = `Called - ${now}`;

    const payload = {
      orderId: order.id,
      applicant: order.applicant,
      noteText: calledNote,
      callbackDate,
      attachment,
      type: "called",
    };

    console.log("Called note:", payload);

    setHistory((prev) => [
      {
        date: now,
        by: "John Smith",
        note: calledNote,
      },
      ...prev,
    ]);

    setNoteText("");
    setCallbackDate("");
    setAttachment(null);
    setErrors({});
  };

  const handleAttachmentChange = (e) => {
    const file = e.target.files?.[0] || null;

    setAttachment(file);
    clearError("attachment");
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[calc(100vh-44px)] w-full max-w-[430px] flex-col overflow-hidden rounded-[8px] bg-white shadow-2xl">
        <div className="flex h-[48px] shrink-0 items-start justify-between border-b border-[#E2E8F0] px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-[#111827]">
              Notes — {order.id}
            </h2>

            <p className="mt-[3px] truncate text-[10px] text-[#007F96]">
              {order.applicant}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-[24px] w-[24px] items-center justify-center rounded-[5px] text-[16px] leading-none text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155]"
            aria-label="Close notes modal"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div>
            <div className="mb-[6px] flex items-center justify-between gap-2">
              <label className="block text-[11px] font-semibold text-[#475569]">
                Note Text <span className="text-red-500">*</span>
              </label>

              <span
                className={`text-[10px] ${
                  noteText.length > MAX_NOTE_LENGTH
                    ? "text-red-500"
                    : "text-[#94A3B8]"
                }`}
              >
                {noteText.length}/{MAX_NOTE_LENGTH}
              </span>
            </div>

            <textarea
              value={noteText}
              onChange={(e) => {
                setNoteText(e.target.value);
                clearError("noteText");
              }}
              placeholder="Enter note..."
              rows={4}
              className={`w-full resize-none rounded-[6px] border bg-white px-3 py-2 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
                errors.noteText
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                  : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
              }`}
            />

            {errors.noteText && (
              <p className="mt-[5px] text-[11px] font-medium text-red-500">
                {errors.noteText}
              </p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-[6px] block text-[11px] font-semibold text-[#475569]">
                Callback Date
              </label>

              <input
                type="date"
                value={callbackDate}
                onChange={(e) => {
                  setCallbackDate(e.target.value);
                  clearError("callbackDate");
                }}
                className={`h-[36px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none focus:ring-2 ${
                  errors.callbackDate
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                    : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
                }`}
              />

              {errors.callbackDate && (
                <p className="mt-[5px] text-[11px] font-medium text-red-500">
                  {errors.callbackDate}
                </p>
              )}
            </div>

            <div>
              <label className="mb-[6px] block text-[11px] font-semibold text-[#475569]">
                Attachment
              </label>

              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleAttachmentChange}
                className={`block h-[36px] w-full rounded-[6px] border bg-white text-[11px] text-[#64748B] file:mr-3 file:h-[34px] file:border-0 file:border-r file:border-[#E2E8F0] file:bg-[#F8FAFC] file:px-3 file:text-[11px] file:font-medium file:text-[#334155] ${
                  errors.attachment ? "border-red-500" : "border-[#CBD5E1]"
                }`}
              />

              {errors.attachment && (
                <p className="mt-[5px] text-[11px] font-medium text-red-500">
                  {errors.attachment}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveNote}
              className="inline-flex h-[32px] items-center justify-center rounded-[6px] bg-[#0097B2] px-4 text-[11px] font-semibold text-white hover:bg-[#0086A0]"
            >
              Save Note
            </button>

            <button
              type="button"
              onClick={handleCalled}
              className="inline-flex h-[32px] items-center justify-center rounded-[6px] bg-[#111827] px-4 text-[11px] font-semibold text-white hover:bg-[#1F2937]"
            >
              Called
            </button>
          </div>

          <div className="mt-5">
            <h3 className="mb-2 text-[11px] font-semibold text-[#475569]">
              Note History
            </h3>

            <div className="space-y-2">
              {history.map((item, index) => (
                <div
                  key={`${item.date}-${index}`}
                  className="rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
                >
                  <p className="text-[10px] font-semibold text-[#007F96]">
                    {item.date}{" "}
                    <span className="font-normal text-[#94A3B8]">
                      — {item.by}
                    </span>
                  </p>

                  <p className="mt-1 text-[11px] text-[#334155]">
                    {item.note}
                  </p>
                </div>
              ))}

              {history.length === 0 && (
                <div className="rounded-[6px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-3 py-5 text-center text-[11px] text-[#94A3B8]">
                  No note history found.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}