"use client";

import { useCallback, useState } from "react";
import { getOrderNotes } from "@/lib/orders/orderApi";
import {
  formatNoteDate,
  formatNotePreview,
  toHistoryItem,
} from "@/lib/orders/orderNoteUtils";
import { ReminderBadge } from "@/components/orders/OrderNotesListModal";

export default function OrderNotesColumn({
  order,
  onOpenNotes,
  onOpenAddNote,
}) {
  const [hoverNotes, setHoverNotes] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fallbackPreview = (order.recentNotes || []).map((note) => ({
    id: note.id,
    date: formatNoteDate(note.noteDate),
    note: note.note || "",
    isReminder: Boolean(note.callbackDate),
    isCalled: Boolean(note.isCalled),
  }));

  const previewItems = hoverNotes ?? fallbackPreview;

  const loadPreview = useCallback(async () => {
    if (!order?.dbId) return;

    setLoadingPreview(true);
    try {
      const notes = await getOrderNotes(order.dbId, { includeCalled: true });
      setHoverNotes(notes.slice(0, 2).map(toHistoryItem));
    } catch {
      setHoverNotes(fallbackPreview);
    } finally {
      setLoadingPreview(false);
    }
  }, [order?.dbId, order?.recentNotes]);

  return (
    <div
      className="group/notes relative"
      onMouseEnter={loadPreview}
      onMouseLeave={() => setHoverNotes(null)}
    >
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => onOpenNotes(order)}
          className="text-left text-[10px] font-semibold text-[#007F96] underline"
        >
          Notes
        </button>

        <button
          type="button"
          onClick={() => onOpenAddNote(order)}
          className="text-left text-[10px] font-medium text-[#007F96] underline"
        >
          Add New Note
        </button>
      </div>

      <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-[300px] rounded-[8px] border border-[#E2E8F0] bg-white p-3 shadow-lg group-hover/notes:block">
        <p className="mb-2 text-[10px] font-semibold text-[#64748B]">
          Recent Notes
        </p>

        {loadingPreview && !hoverNotes ? (
          <p className="text-[10px] text-[#94A3B8]">Loading...</p>
        ) : previewItems.length === 0 ? (
          <p className="text-[10px] text-[#94A3B8]">No notes yet.</p>
        ) : (
          <div className="space-y-2">
            {previewItems.map((item) => (
              <div
                key={item.id}
                className="rounded-[6px] border border-[#F1F5F9] bg-[#F8FAFC] px-2.5 py-2"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] font-semibold text-[#334155]">
                    {item.date}
                  </span>
                  {item.isReminder ? (
                    <ReminderBadge called={item.isCalled} />
                  ) : null}
                </div>
                <p className="mt-1 text-[10px] leading-[14px] text-[#475569]">
                  {formatNotePreview(item.note, 120)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
