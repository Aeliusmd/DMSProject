"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/notifications/notificationsApi";

const notificationTypes = ["All", "Order", "Invoice", "Reminder", "Activity"];

export default function NotificationsPageContent() {
  const router = useRouter();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeType, setActiveType] = useState("All");
  const [searchValue, setSearchValue] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getNotifications({
        type: activeType,
        search: searchValue,
        limit: 200,
      });

      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      setNotifications([]);
      setUnreadCount(0);
      setError(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [activeType, searchValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadNotifications();
    }, 250);

    return () => clearTimeout(timeout);
  }, [loadNotifications]);

  const filteredNotifications = useMemo(() => notifications, [notifications]);

  const handleToggleRead = async (notificationId) => {
    const target = notifications.find((item) => item.id === notificationId);
    if (!target || target.read) {
      return;
    }

    try {
      const result = await markNotificationAsRead(notificationId);
      setUnreadCount(result.unreadCount);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch {
      setError("Failed to update notification");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          read: true,
        }))
      );
    } catch {
      setError("Failed to mark all notifications as read");
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#111827]">
            Notifications
          </h1>

          <p className="mt-1 text-[12px] text-[#64748B]">
            {loading
              ? "Loading notifications..."
              : `You have ${unreadCount} unread notification${
                  unreadCount === 1 ? "" : "s"
                }`}
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
          {loading
            ? "Loading..."
            : `Showing ${filteredNotifications.length} notification${
                filteredNotifications.length === 1 ? "" : "s"
              }`}
        </p>
      </div>

      {error && (
        <div className="rounded-[8px] border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[12px] font-medium text-red-600">
          {error}
        </div>
      )}

      <section className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
        <div className="h-full overflow-auto">
          {loading && (
            <div className="px-5 py-16 text-center text-[13px] text-[#94A3B8]">
              Loading notifications...
            </div>
          )}

          {!loading &&
            filteredNotifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onToggleRead={handleToggleRead}
            />
          ))}

          {!loading && filteredNotifications.length === 0 && (
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

        {notification.description ? (
          <p className="mt-1 truncate text-[11px] text-[#64748B]">
            {notification.description}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-[10px] text-[#94A3B8]">
            {notification.time}
          </span>

          {!notification.read && (
            <button
              type="button"
              onClick={() => onToggleRead(notification.id)}
              className="text-[10px] font-semibold text-[#0097B2] hover:underline"
            >
              Mark read
            </button>
          )}
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