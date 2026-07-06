"use client";

import { MAX_NOTE_LENGTH } from "@/lib/orders/orderNoteUtils";

export default function OrderNoteFormFields({
  noteText,
  callbackDate,
  attachment,
  existingAttachmentUrl,
  errors = {},
  readOnly = false,
  onNoteTextChange,
  onCallbackDateChange,
  onAttachmentChange,
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-[6px] flex items-center justify-between gap-2">
          <label className="block text-[11px] font-semibold text-[#475569]">
            Note Text <span className="text-red-500">*</span>
          </label>

          {!readOnly && (
            <span
              className={`text-[10px] ${
                noteText.length > MAX_NOTE_LENGTH
                  ? "text-red-500"
                  : "text-[#94A3B8]"
              }`}
            >
              {noteText.length}/{MAX_NOTE_LENGTH}
            </span>
          )}
        </div>

        {readOnly ? (
          <p className="whitespace-pre-wrap rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[12px] leading-[18px] text-[#334155]">
            {noteText || "—"}
          </p>
        ) : (
          <textarea
            value={noteText}
            onChange={(e) => onNoteTextChange?.(e.target.value)}
            placeholder="Enter note..."
            rows={4}
            className={`w-full resize-none rounded-[6px] border bg-white px-3 py-2 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
              errors.noteText
                ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
            }`}
          />
        )}

        {errors.noteText && (
          <p className="mt-[5px] text-[11px] font-medium text-red-500">
            {errors.noteText}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-[6px] block text-[11px] font-semibold text-[#475569]">
            Callback Date
          </label>

          {readOnly ? (
            <p className="h-[36px] rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#334155]">
              {callbackDate || "—"}
            </p>
          ) : (
            <input
              type="date"
              value={callbackDate}
              onChange={(e) => onCallbackDateChange?.(e.target.value)}
              className={`h-[36px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none focus:ring-2 ${
                errors.callbackDate
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                  : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
              }`}
            />
          )}

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

          {readOnly ? (
            existingAttachmentUrl ? (
              <a
                href={existingAttachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-[36px] items-center text-[11px] font-semibold text-[#0097B2] underline"
              >
                View attachment
              </a>
            ) : (
              <p className="h-[36px] text-[12px] text-[#94A3B8]">—</p>
            )
          ) : (
            <>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => onAttachmentChange?.(e.target.files?.[0] || null)}
                className={`block h-[36px] w-full rounded-[6px] border bg-white text-[11px] text-[#64748B] file:mr-3 file:h-[34px] file:border-0 file:border-r file:border-[#E2E8F0] file:bg-[#F8FAFC] file:px-3 file:text-[11px] file:font-medium file:text-[#334155] ${
                  errors.attachment ? "border-red-500" : "border-[#CBD5E1]"
                }`}
              />

              {!attachment && existingAttachmentUrl && (
                <a
                  href={existingAttachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-[5px] inline-block text-[10px] font-semibold text-[#0097B2] underline"
                >
                  Current attachment
                </a>
              )}

              {errors.attachment && (
                <p className="mt-[5px] text-[11px] font-medium text-red-500">
                  {errors.attachment}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
