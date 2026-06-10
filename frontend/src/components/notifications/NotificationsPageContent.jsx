"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const defaultNotifications = [
  {
    id: 1,
    type: "Order",
    title: "New Order Added — ORD-2026-012",
    description: "Taylor Bankruptcy Filing",
    time: "5 min ago",
    read: false,
  },
  {
    id: 2,
    type: "Invoice",
    title: "Invoice Generated — INV-019 for Thompson Industries",
    description: "",
    time: "18 min ago",
    read: false,
  },
  {
    id: 3,
    type: "Reminder",
    title: "Reminder Alert — Smith vs. Johnson forms due in 2 days",
    description: "",
    time: "1 hour ago",
    read: false,
  },
  {
    id: 4,
    type: "Activity",
    title: "Employee Activity — Sarah J. updated case ORD-2026-003",
    description: "",
    time: "2 hours ago",
    read: false,
  },
  {
    id: 5,
    type: "Order",
    title: "Order Status Changed — ORD-2026-005 marked as Completed",
    description: "",
    time: "3 hours ago",
    read: true,
  },
  {
    id: 6,
    type: "Invoice",
    title: "Payment Received — $2,450 for INV-008 (Brown Family Trust)",
    description: "",
    time: "5 hours ago",
    read: true,
  },
  {
    id: 7,
    type: "Order",
    title: "Subpoena Served — ORD-2026-001 (Smith vs. Johnson)",
    description: "",
    time: "Yesterday, 4:30 PM",
    read: true,
  },
  {
    id: 8,
    type: "Activity",
    title: "New Employee Added — Michael R. joined the team",
    description: "",
    time: "Yesterday, 2:15 PM",
    read: true,
  },
  {
    id: 9,
    type: "Invoice",
    title: "Write Off Approved — INV-015 for Lee Tech Holdings",
    description: "",
    time: "Yesterday, 11:00 AM",
    read: true,
  },
  {
    id: 10,
    type: "Reminder",
    title: "Reminder Alert — Pickup due for Williams Criminal Defense",
    description: "",
    time: "Yesterday, 9:30 AM",
    read: true,
  },
  {
    id: 11,
    type: "Order",
    title: "Order Cancelled — ORD-2026-007 (Rodriguez Divorce)",
    description: "",
    time: "Yesterday, 8:50 AM",
    read: true,
  },
  {
    id: 12,
    type: "Invoice",
    title: "Invoice Resent — INV-021 to Davis Law Firm",
    description: "",
    time: "2 days ago",
    read: true,
  },
  {
    id: 13,
    type: "Order",
    title: "Records Uploaded — ORD-2026-009",
    description: "",
    time: "2 days ago",
    read: true,
  },
  {
    id: 14,
    type: "Activity",
    title: "Employee Activity — John Doe updated settings",
    description: "",
    time: "2 days ago",
    read: true,
  },
  {
    id: 15,
    type: "Reminder",
    title: "Reminder Alert — Invoice follow-up due tomorrow",
    description: "",
    time: "2 days ago",
    read: true,
  },
  {
    id: 16,
    type: "Invoice",
    title: "Invoice Generated — INV-022 for Pacific Law Partners",
    description: "",
    time: "3 days ago",
    read: true,
  },
  {
    id: 17,
    type: "Order",
    title: "New Order Added — ORD-2026-014",
    description: "Martinez Legal Group",
    time: "3 days ago",
    read: true,
  },
  {
    id: 18,
    type: "Activity",
    title: "Employee Activity — Lisa T. added note history",
    description: "",
    time: "3 days ago",
    read: true,
  },
  {
    id: 19,
    type: "Reminder",
    title: "Reminder Alert — Serve payment check pending",
    description: "",
    time: "4 days ago",
    read: true,
  },
  {
    id: 20,
    type: "Invoice",
    title: "Payment Received — INV-017 marked as paid",
    description: "",
    time: "4 days ago",
    read: true,
  },
];

const notificationTypes = ["All", "Order", "Invoice", "Reminder", "Activity"];

export default function NotificationsPageContent({
  notificationsSeed = defaultNotifications,
}) {
  const router = useRouter();

  const [notifications, setNotifications] = useState(notificationsSeed);
  const [activeType, setActiveType] = useState("All");
  const [searchValue, setSearchValue] = useState("");

  const unreadCount = notifications.filter((item) => !item.read).length;

  const filteredNotifications = useMemo(() => {
    const search = searchValue.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesType =
        activeType === "All" || notification.type === activeType;

      const matchesSearch =
        !search ||
        notification.title.toLowerCase().includes(search) ||
        notification.description.toLowerCase().includes(search) ||
        notification.type.toLowerCase().includes(search);

      return matchesType && matchesSearch;
    });
  }, [notifications, activeType, searchValue]);

  const handleToggleRead = (notificationId) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: !notification.read }
          : notification
      )
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        read: true,
      }))
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#111827]">
            Notifications
          </h1>

          <p className="mt-1 text-[12px] text-[#64748B]">
            You have {unreadCount} unread notification
            {unreadCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
          >
            <DoubleCheckIcon />
            Mark all as read
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
          >
            <BackIcon />
            Back
          </button>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 items-center gap-4 xl:grid-cols-[minmax(260px,420px)_auto_1fr]">
        <div className="relative w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex w-[36px] items-center justify-center text-[#94A3B8]">
            <SearchIcon />
          </div>

          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search notifications..."
            className="h-[36px] w-full rounded-[6px] border border-[#CBD5E1] bg-white pl-[38px] pr-3 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-[#64748B]">
            Type:
          </span>

          <div className="flex flex-wrap items-center gap-1 rounded-[6px] border border-[#E2E8F0] bg-white p-[3px]">
            {notificationTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(type)}
                className={`h-[28px] rounded-[5px] px-4 text-[11px] font-semibold transition ${
                  activeType === type
                    ? "bg-[#0097B2] text-white shadow-sm"
                    : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111827]"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <p className="justify-self-start text-[11px] text-[#64748B] xl:justify-self-end">
          Showing {filteredNotifications.length} of {notifications.length}{" "}
          notifications
        </p>
      </div>

      <section className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
        <div className="h-full overflow-auto">
          {filteredNotifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onToggleRead={handleToggleRead}
            />
          ))}

          {filteredNotifications.length === 0 && (
            <div className="px-5 py-16 text-center text-[13px] text-[#94A3B8]">
              No notifications found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function NotificationRow({ notification, onToggleRead }) {
  return (
    <div
      className={`grid grid-cols-[18px_42px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-[#F1F5F9] px-4 py-4 last:border-b-0 hover:bg-[#F8FBFC] ${
        notification.read ? "bg-white" : "bg-[#F7FEFF]"
      }`}
    >
      <div className="flex justify-center">
        {!notification.read && (
          <span className="h-[7px] w-[7px] rounded-full bg-[#0097B2]" />
        )}
      </div>

      <div
        className={`flex h-[34px] w-[34px] items-center justify-center rounded-[10px] ${getIconStyles(
          notification.type
        )}`}
      >
        <NotificationIcon type={notification.type} />
      </div>

      <div className="min-w-0">
        <p
          className={`truncate text-[12px] ${
            notification.read
              ? "font-medium text-[#334155]"
              : "font-semibold text-[#111827]"
          }`}
        >
          {notification.title}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-[10px] text-[#94A3B8]">
            {notification.time}
          </span>

          <button
            type="button"
            onClick={() => onToggleRead(notification.id)}
            className="text-[10px] font-semibold text-[#0097B2] hover:underline"
          >
            {notification.read ? "Mark unread" : "Mark read"}
          </button>
        </div>
      </div>

      <span className={`rounded-full px-2 py-[3px] text-[10px] font-semibold ${getTypeBadgeStyles(notification.type)}`}>
        {notification.type}
      </span>

      <CheckIcon />
    </div>
  );
}

function getIconStyles(type) {
  const styles = {
    Order: "bg-[#BDECF3] text-[#0097B2]",
    Invoice: "bg-[#BBF7D0] text-[#059669]",
    Reminder: "bg-[#FEF3C7] text-[#D97706]",
    Activity: "bg-[#DBEAFE] text-[#2563EB]",
  };

  return styles[type] || "bg-[#F1F5F9] text-[#64748B]";
}

function getTypeBadgeStyles(type) {
  const styles = {
    Order: "bg-[#E6F7FA] text-[#007F96]",
    Invoice: "bg-[#ECFDF5] text-[#059669]",
    Reminder: "bg-[#FFF7ED] text-[#EA580C]",
    Activity: "bg-[#EFF6FF] text-[#2563EB]",
  };

  return styles[type] || "bg-[#F1F5F9] text-[#64748B]";
}

function NotificationIcon({ type }) {
  if (type === "Invoice") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path
          d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3Z"
          stroke="currentColor"
          strokeWidth="1.8"
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

  if (type === "Reminder") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
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

  if (type === "Activity") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M7 3h10v18H7V3Z" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9 8h6M9 12h6M9 16h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m20 20-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DoubleCheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="m3 12 4 4L17 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m12 15 2 2 7-8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M19 12H5M11 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="text-[#94A3B8]"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="m5 12 4 4L19 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}