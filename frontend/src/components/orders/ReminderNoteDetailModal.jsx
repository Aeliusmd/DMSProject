"use client";

import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import OrderNoteFormFields from "@/components/orders/OrderNoteFormFields";
import { ReminderBadge } from "@/components/orders/OrderNotesListModal";

export default function ReminderNoteDetailModal({ reminder, onClose }) {
  const mounted = useIsClient();

  if (!mounted || !reminder) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[calc(100vh-44px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[8px] bg-white shadow-2xl">
        <div className="flex h-[48px] shrink-0 items-start justify-between border-b border-[#E2E8F0] px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-[#111827]">
              Reminder — {reminder.orderNumber || reminder.caseNumber}
            </h2>
            <div className="mt-[3px] flex flex-wrap items-center gap-2">
              <p className="truncate text-[10px] text-[#007F96]">
                {reminder.applicant}
              </p>
              <ReminderBadge called={reminder.isCalled} />
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-[24px] w-[24px] items-center justify-center rounded-[5px] text-[16px] leading-none text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155]"
            aria-label="Close reminder detail"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField label="Date" value={reminder.date} />
            <DetailField label="By" value={reminder.by} />
            <DetailField
              label="Callback Date"
              value={
                reminder.callbackDateDisplay || reminder.callbackDate || "—"
              }
            />
            <DetailField
              label="Status"
              value={reminder.isCalled ? "Calledback" : "Not Calledback"}
            />
          </div>

          <OrderNoteFormFields
            noteText={reminder.note || ""}
            callbackDate={reminder.callbackDate || ""}
            existingAttachmentUrl={reminder.attachmentUrl || ""}
            readOnly
          />
        </div>
      </section>
    </div>,
    document.body
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold text-[#64748B]">{label}</p>
      <p className="text-[12px] font-medium text-[#334155]">{value || "—"}</p>
    </div>
  );
}
