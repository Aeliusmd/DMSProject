"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export default function NotificationsModal({
  open,
  notifications = [],
  unreadCount = 0,
  onClose,
  triggerRef,
  onRefresh,
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event) => {
      const clickedInsideModal = modalRef.current?.contains(event.target);
      const clickedTrigger = triggerRef?.current?.contains(event.target);

      if (!clickedInsideModal && !clickedTrigger) {
        onClose?.();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  const resolvedUnreadCount =
    unreadCount || notifications.filter((item) => !item.read).length;

  return (
    <div
      ref={modalRef}
      className="absolute right-0 top-[38px] z-[999] w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]"
    >
      <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3">
        <h2 className="text-[12px] font-semibold text-[#111827]">
          Notifications
        </h2>

        <span className="rounded-full bg-[#E6F7FA] px-2 py-[3px] text-[10px] font-semibold text-[#007F96]">
          {resolvedUnreadCount} new
        </span>
      </div>

      <div className="max-h-[300px] overflow-y-auto">
        {notifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}

        {notifications.length === 0 && (
          <div className="px-4 py-8 text-center text-[12px] text-[#94A3B8]">
            No notifications found.
          </div>
        )}
      </div>

      <div className="border-t border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3 text-center">
  <Link
    href="/notifications"
    onClick={() => {
      onRefresh?.();
      onClose?.();
    }}
    className="text-[11px] font-semibold text-[#0097B2] hover:underline"
  >
    View all notifications
  </Link>
</div>
    </div>
  );
}

function NotificationItem({ notification }) {
  const iconType = String(notification.type || "").toLowerCase();

  return (
    <button
      type="button"
      className="flex w-full gap-3 border-b border-[#F8FAFC] px-4 py-3 text-left hover:bg-[#F8FBFC] last:border-b-0"
    >
      <div className="mt-[2px] flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B]">
        <NotificationIcon type={iconType} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[11px] font-semibold leading-[16px] text-[#334155]">
          {notification.title}
        </p>

        {notification.description && (
          <p className="mt-[2px] line-clamp-1 text-[10px] leading-[14px] text-[#64748B]">
            {notification.description}
          </p>
        )}

        <p className="mt-[4px] text-[10px] text-[#94A3B8]">
          {notification.time}
        </p>
      </div>

      {!notification.read && (
        <span className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full bg-[#0097B2]" />
      )}
    </button>
  );
}

function NotificationIcon({ type }) {
  if (type === "invoice") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M10 8h4M10 12h4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === "reminder") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"
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

  if (type === "activity") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <circle
          cx="9"
          cy="8"
          r="3"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M3 20a6 6 0 0 1 12 0"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M17 10a3 3 0 1 0 0-6"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 3h10v18H7V3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 8h6M9 12h6M9 16h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}