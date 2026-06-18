"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/authApi";
import { getDueRemindersToday } from "@/lib/orders/orderApi";
import {
  markReminderPopupShownToday,
  wasReminderPopupShownToday,
} from "@/lib/notifications/reminderPopupStorage";

export default function DailyReminderPopup() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const user = await getCurrentUser();
        if (!active || !user?.id) return;

        if (wasReminderPopupShownToday(user.id)) {
          return;
        }

        const data = await getDueRemindersToday();
        if (!active) return;

        if (data.enabled && data.reminders?.length > 0) {
          setReminders(data.reminders);
          setIsOpen(true);
        }
      } catch {
        // Ignore popup errors so dashboard still loads normally.
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleDismiss = async () => {
    try {
      const user = await getCurrentUser();
      if (user?.id) {
        markReminderPopupShownToday(user.id);
      }
    } catch {
      // Still close the popup even if user lookup fails.
    }

    setIsOpen(false);
  };

  const handleOpenOrder = (orderId) => {
    if (!orderId) return;
    handleDismiss();
    router.push(`/orders/new?mode=edit&orderId=${encodeURIComponent(orderId)}`);
  };

  if (loading || !isOpen || !reminders.length) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[min(80vh,640px)] w-full max-w-[560px] flex-col overflow-hidden rounded-[12px] bg-white shadow-2xl">
        <div className="border-b border-[#E2E8F0] bg-[#FFFBEB] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[#FEF3C7] text-[#D97706]">
              <BellIcon />
            </div>

            <div>
              <h2 className="text-[15px] font-semibold text-[#111827]">
                Reminders Due Today
              </h2>
              <p className="mt-1 text-[12px] text-[#64748B]">
                You have {reminders.length} reminder
                {reminders.length === 1 ? "" : "s"} scheduled for today.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <button
                key={reminder.noteId}
                type="button"
                onClick={() => handleOpenOrder(reminder.orderId)}
                className="w-full rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-left transition hover:border-[#0097B2] hover:bg-[#F0FDFF]"
              >
                <p className="text-[12px] font-semibold text-[#111827]">
                  {reminder.orderNumber || reminder.caseNumber || "Order"}
                </p>

                {reminder.applicant ? (
                  <p className="mt-1 text-[11px] text-[#475569]">
                    {reminder.applicant}
                  </p>
                ) : null}

                {reminder.note ? (
                  <p className="mt-2 line-clamp-2 text-[11px] leading-[16px] text-[#64748B]">
                    {reminder.note}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
          <button
            type="button"
            onClick={() => {
              handleDismiss();
              router.push("/notifications");
            }}
            className="inline-flex h-[34px] items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] hover:bg-white"
          >
            View notifications
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex h-[34px] items-center justify-center rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
          >
            Got it
          </button>
        </div>
      </section>
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}
