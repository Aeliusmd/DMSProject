"use client";

import { useRef, useState } from "react";
import NotificationsModal from "@/components/layout/NotificationsModal";
import { getStoredUser } from "@/lib/auth/authStorage";

const notifications = [
  {
    id: 1,
    type: "order",
    title: "New Order Added — ORD-2026-012",
    description: "Taylor Bankruptcy Filing",
    time: "5 min ago",
    read: false,
  },
  {
    id: 2,
    type: "invoice",
    title: "Invoice Generated — INV-019",
    description: "Thompson Industries",
    time: "18 min ago",
    read: false,
  },
  {
    id: 3,
    type: "reminder",
    title: "Reminder Alert — Smith vs. Johnson",
    description: "forms due in 2 days",
    time: "1 hour ago",
    read: false,
  },
  {
    id: 4,
    type: "employee",
    title: "Employee Activity — Sarah J. updated",
    description: "case notes for ORD-2026-009",
    time: "2 hours ago",
    read: false,
  },
];

export default function Topbar({ onToggleSidebar }) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationButtonRef = useRef(null);

  const user = getStoredUser();
  const displayName = user?.name || "User";
  const initials = getInitials(displayName);

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <header className="sticky top-0 z-30 flex min-h-[52px] items-center gap-2 border-b border-[#E2E8F0] bg-white px-2 py-2 sm:gap-3 sm:px-[18px]">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[6px] text-[#0097B2] hover:bg-[#E6F7FA]"
      >
        <MenuIcon />
      </button>

      <div className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-2 sm:gap-[18px]">
        <div className="relative">
          <button
            ref={notificationButtonRef}
            type="button"
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            className={`relative flex h-[30px] w-[30px] items-center justify-center rounded-[6px] text-[#64748B] hover:bg-[#F8FAFC] ${
              isNotificationsOpen ? "bg-[#F8FAFC] text-[#0097B2]" : ""
            }`}
            aria-label="Open notifications"
          >
            <BellIcon />

            {unreadCount > 0 && (
              <span className="absolute right-[7px] top-[6px] h-[6px] w-[6px] rounded-full bg-[#EF4444]" />
            )}
          </button>

          <NotificationsModal
            open={isNotificationsOpen}
            notifications={notifications}
            triggerRef={notificationButtonRef}
            onClose={() => setIsNotificationsOpen(false)}
          />
        </div>

        <button
          type="button"
          className="flex shrink-0 items-center gap-[7px] rounded-[6px] px-1 py-1 hover:bg-[#F8FAFC] sm:gap-[9px]"
        >
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#BDECF3] text-[11px] font-medium text-[#007F96]">
            {initials}
          </div>

          <p className="hidden text-[13px] font-medium text-[#111827] sm:block">
            {displayName}
          </p>
        </button>
      </div>
    </header>
  );
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function MenuIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}