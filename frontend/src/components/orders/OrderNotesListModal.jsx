"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import { getOrderNotesPaginated, updateOrderNote } from "@/lib/orders/orderApi";
import {
  buildCallbackLine,
  filterNotesByDate,
  MAX_NOTE_LENGTH,
  toHistoryItem,
  validateNoteForm,
} from "@/lib/orders/orderNoteUtils";
import OrderNoteFormFields from "@/components/orders/OrderNoteFormFields";

const EMPTY_DATE_FILTERS = {
  from: "",
  to: "",
};

const VISIBLE_NOTE_COUNT = 5;
const COLLAPSED_NOTE_ROW_HEIGHT_PX = 84;
const NOTES_LIST_MAX_HEIGHT =
  VISIBLE_NOTE_COUNT * COLLAPSED_NOTE_ROW_HEIGHT_PX +
  (VISIBLE_NOTE_COUNT - 1) * 8;
const NOTES_PAGE_SIZE = 10;

export default function OrderNotesListModal({ isOpen, order, onClose, onSaved }) {
  const mounted = useIsClient();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [hasMoreNotes, setHasMoreNotes] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [markCalledPending, setMarkCalledPending] = useState(false);
  const [dateFilters, setDateFilters] = useState(EMPTY_DATE_FILTERS);
  const [appliedDateFilters, setAppliedDateFilters] = useState(EMPTY_DATE_FILTERS);

  const orderId = order?.dbId ?? order?.id ?? null;
  const expandedNote = notes.find(
    (item) => Number(item.id) === Number(expandedNoteId)
  );
  const isReadOnly = Boolean(expandedNote?.isCalled);

  const filteredNotes = useMemo(
    () => filterNotesByDate(notes, appliedDateFilters),
    [notes, appliedDateFilters]
  );

  const hasActiveDateFilters = Boolean(
    appliedDateFilters.from || appliedDateFilters.to
  );

  const resetExpandedForm = () => {
    setExpandedNoteId(null);
    setNoteText("");
    setCallbackDate("");
    setAttachment(null);
    setExistingAttachmentUrl("");
    setErrors({});
    setMarkCalledPending(false);
  };

  const applyExpandedNote = (item) => {
    if (!item) {
      resetExpandedForm();
      return;
    }

    setExpandedNoteId(item.id);
    setNoteText(item.note);
    setCallbackDate(item.callbackDate || "");
    setExistingAttachmentUrl(item.attachmentUrl || "");
    setAttachment(null);
    setErrors({});
    setMarkCalledPending(false);
  };

  const loadNotesPage = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      const result = await getOrderNotesPaginated(orderId, {
        includeCalled: true,
        cursor,
        pageSize: NOTES_PAGE_SIZE,
        fromDate: appliedDateFilters.from,
        toDate: appliedDateFilters.to,
      });
      const mapped = (result.notes || []).map(toHistoryItem);
      setNotes((prev) => (append ? [...prev, ...mapped] : mapped));
      setHasMoreNotes(Boolean(result.pagination?.hasMore));
      setNextCursor(result.pagination?.nextCursor ?? null);
      return mapped;
    },
    [orderId, appliedDateFilters.from, appliedDateFilters.to]
  );

  useEffect(() => {
    if (!isOpen || !orderId) return undefined;

    let active = true;
    resetExpandedForm();
    setDateFilters(EMPTY_DATE_FILTERS);
    setAppliedDateFilters(EMPTY_DATE_FILTERS);
    setLoadError("");
    setLoading(true);

    setHasMoreNotes(false);
    setNextCursor(null);
    loadNotesPage()
      .then(() => {})
      .catch((err) => {
        if (active) {
          setNotes([]);
          setLoadError(err.message || "Failed to load notes");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, orderId, loadNotesPage]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!mounted || !isOpen || !order) return null;

  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSelectNote = (item) => {
    if (expandedNoteId === item.id) {
      resetExpandedForm();
      return;
    }

    applyExpandedNote(item);
  };

  const handleCall = () => {
    if (!expandedNoteId || isReadOnly || saving) return;

    const callLine = buildCallbackLine();
    const nextText = noteText.trim()
      ? `${noteText.trim()}\n${callLine}`
      : callLine;

    if (nextText.length > MAX_NOTE_LENGTH) {
      setErrors({
        noteText: `Note cannot be more than ${MAX_NOTE_LENGTH} characters.`,
      });
      return;
    }

    setNoteText(nextText);
    setMarkCalledPending(true);
    clearError("noteText");
  };

  const handleLoadMore = async () => {
    if (!hasMoreNotes || !nextCursor || loadingMore || loading) return;
    setLoadingMore(true);
    setLoadError("");
    try {
      await loadNotesPage({ cursor: nextCursor, append: true });
    } catch (err) {
      setLoadError(err.message || "Failed to load more notes");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleListScroll = (event) => {
    const element = event.currentTarget;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom <= 80) {
      handleLoadMore();
    }
  };

  const handleSave = async () => {
    if (!expandedNoteId || isReadOnly) return;

    const nextErrors = validateNoteForm({
      noteText,
      callbackDate,
      attachment,
      existingAttachmentUrl,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const savedNoteId = expandedNoteId;

    setSaving(true);
    setLoadError("");

    try {
      await updateOrderNote(orderId, savedNoteId, {
        note: noteText.trim(),
        callbackDate,
        attachment,
        markCalled: markCalledPending,
      });

      const refreshedNotes = await loadNotesPage();

      const savedNote = refreshedNotes.find(
        (item) => Number(item.id) === Number(savedNoteId)
      );
      applyExpandedNote(savedNote);
      onSaved?.();
    } catch (err) {
      setErrors({ noteText: err.message || "Failed to update note" });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyDateFilters = () => {
    setAppliedDateFilters({
      from: dateFilters.from,
      to: dateFilters.to,
    });
    resetExpandedForm();
  };

  const handleResetDateFilters = () => {
    setDateFilters(EMPTY_DATE_FILTERS);
    setAppliedDateFilters(EMPTY_DATE_FILTERS);
    resetExpandedForm();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[calc(100vh-44px)] w-full max-w-[760px] flex-col overflow-hidden rounded-[8px] bg-white shadow-2xl">
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

        <div className="shrink-0 border-b border-[#E2E8F0] px-5 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <DateFilterField
              label="From"
              value={dateFilters.from}
              onChange={(value) =>
                setDateFilters((prev) => ({ ...prev, from: value }))
              }
            />
            <DateFilterField
              label="To"
              value={dateFilters.to}
              onChange={(value) =>
                setDateFilters((prev) => ({ ...prev, to: value }))
              }
            />
            <button
              type="button"
              onClick={handleApplyDateFilters}
              className="h-[32px] rounded-[6px] bg-[#0097B2] px-4 text-[11px] font-semibold text-white hover:bg-[#0086A0]"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={handleResetDateFilters}
              className="h-[32px] rounded-[6px] bg-[#F1F5F9] px-4 text-[11px] font-semibold text-[#334155] hover:bg-[#E2E8F0]"
            >
              Reset
            </button>
          </div>

          {hasActiveDateFilters && (
            <p className="mt-2 text-[10px] text-[#64748B]">
              Date filters applied
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-[12px] text-[#94A3B8]">
              Loading notes...
            </p>
          ) : loadError ? (
            <p className="py-8 text-center text-[12px] font-medium text-red-500">
              {loadError}
            </p>
          ) : notes.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-[#94A3B8]">
              No notes for this order yet.
            </p>
          ) : filteredNotes.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-[#94A3B8]">
              No notes match your date filters.
            </p>
          ) : (
            <>
              {filteredNotes.length > VISIBLE_NOTE_COUNT && (
                <p className="mb-2 text-[10px] text-[#64748B]">
                  Showing {filteredNotes.length} notes — scroll for older entries
                </p>
              )}

              <div
                className="overflow-y-auto overscroll-y-contain pr-1"
                style={{ maxHeight: NOTES_LIST_MAX_HEIGHT }}
                onScroll={handleListScroll}
              >
                <div className="space-y-2">
                  {filteredNotes.map((item) => {
                const isExpanded = Number(item.id) === Number(expandedNoteId);

                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-[8px] border border-[#E2E8F0]"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectNote(item)}
                      className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition ${
                        isExpanded ? "bg-[#F0FBFD]" : "bg-white hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold text-[#007F96]">
                            {item.date}
                          </span>
                          <span className="text-[10px] text-[#64748B]">
                            by {item.by}
                          </span>
                          {item.isReminder && (
                            <ReminderBadge called={item.isCalled} />
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[12px] text-[#334155]">
                          {item.note || "—"}
                        </p>
                      </div>

                      <span className="shrink-0 text-[12px] text-[#94A3B8]">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[#E2E8F0] bg-white px-4 py-4">
                        <OrderNoteFormFields
                          noteText={noteText}
                          callbackDate={callbackDate}
                          attachment={attachment}
                          existingAttachmentUrl={existingAttachmentUrl}
                          errors={errors}
                          readOnly={isReadOnly}
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

                        {!isReadOnly && (
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={handleSave}
                              disabled={saving}
                              className="inline-flex h-[32px] items-center justify-center rounded-[6px] bg-[#0097B2] px-4 text-[11px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>

                            <button
                              type="button"
                              onClick={handleCall}
                              disabled={saving}
                              className="inline-flex h-[32px] items-center justify-center rounded-[6px] bg-[#111827] px-4 text-[11px] font-semibold text-white hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Called
                            </button>
                          </div>
                        )}

                        {isReadOnly && (
                          <p className="mt-3 text-[11px] text-[#64748B]">
                            This note was called back and is shown in reminders as
                            read-only.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
                  })}
                </div>
                {loadingMore ? (
                  <p className="py-3 text-center text-[10px] text-[#64748B]">
                    Loading more notes...
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

function DateFilterField({ label, value, onChange }) {
  return (
    <div className="min-w-0 flex-1 sm:max-w-[160px]">
      <label className="mb-1 block text-[10px] font-medium text-[#64748B]">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[32px] w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-2 text-[11px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
      />
    </div>
  );
}

export function ReminderBadge({ called = false }) {
  return (
    <span
      className={`inline-flex h-[18px] items-center rounded-full px-2 text-[9px] font-semibold ${
        called
          ? "bg-[#ECFDF5] text-[#059669]"
          : "bg-[#FEF3C7] text-[#B45309]"
      }`}
    >
      {called ? "Reminder" : "Reminder"}
    </span>
  );
}
