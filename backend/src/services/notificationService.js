const Notification = require("../models/Notification");
const Employee = require("../models/Employee");
const EmployeeSettings = require("../models/EmployeeSettings");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const { sanitizeSearchText } = require("../utils/sanitize");

const NOTIFICATION_TYPES = ["order", "invoice", "reminder", "activity"];

const PREFERENCE_KEYS = {
  orderCreate: "notifyNewOrders",
  orderStatus: "notifyCaseStatus",
  invoice: "notifyInvoiceReminders",
  activity: "notifyEmployeeActivity",
  reminder: "notifyCaseStatus",
};

const PREFERENCE_COLUMN_MAP = {
  notifyNewOrders: "notify_new_orders",
  notifyInvoiceReminders: "notify_invoice_reminders",
  notifyEmployeeActivity: "notify_employee_activity",
  notifyCaseStatus: "notify_case_status",
};

function readPreferenceValue(settings, preferenceKey) {
  if (!settings) {
    return true;
  }

  const column = PREFERENCE_COLUMN_MAP[preferenceKey];

  if (!column) {
    return true;
  }

  const value = settings[column];

  if (value === null || value === undefined) {
    return true;
  }

  return Boolean(Number(value));
}

function capitalizeType(type) {
  const normalized = String(type || "").toLowerCase();
  if (!normalized) return "Activity";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatRelativeTime(value) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return `Yesterday, ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}`;
  }

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function mapNotificationRow(row) {
  const createdAt = row.created_at;

  return {
    id: row.id,
    type: capitalizeType(row.notification_type),
    notificationType: row.notification_type,
    title: row.title || "",
    description: row.description || "",
    time: formatRelativeTime(createdAt),
    read: Boolean(row.is_read),
    referenceType: row.reference_type || null,
    referenceId: row.reference_id || null,
    createdAt,
    readAt: row.read_at || null,
  };
}

async function isPreferenceEnabled(employeeId, preferenceKey) {
  const settings = await EmployeeSettings.ensureForEmployee(employeeId);
  return readPreferenceValue(settings, preferenceKey);
}

async function getActiveEmployees() {
  const employees = await Employee.findAll();
  return employees.filter(
    (employee) => !employee.is_terminated && !employee.deleted_at
  );
}

async function createNotification({
  employeeId,
  notificationType,
  title,
  description = "",
  referenceType = null,
  referenceId = null,
}) {
  if (!employeeId || !title) {
    return null;
  }

  const normalizedType = String(notificationType || "activity").toLowerCase();

  if (!NOTIFICATION_TYPES.includes(normalizedType)) {
    return null;
  }

  try {
    return await Notification.create({
      employeeId,
      notificationType: normalizedType,
      title,
      description,
      referenceType,
      referenceId,
    });
  } catch (error) {
    logger.error("Failed to create notification row", {
      error: error.message,
      employeeId,
      notificationType: normalizedType,
      title,
    });
    return null;
  }
}

async function dispatchSystemWide({
  notificationType,
  preferenceKey,
  title,
  description = "",
  referenceType = null,
  referenceId = null,
}) {
  try {
    const employees = await getActiveEmployees();

    await Promise.all(
      employees.map(async (employee) => {
        const enabled = await isPreferenceEnabled(employee.id, preferenceKey);

        if (!enabled) {
          return null;
        }

        return createNotification({
          employeeId: employee.id,
          notificationType,
          title,
          description,
          referenceType,
          referenceId,
        });
      })
    );
  } catch (error) {
    logger.error("Failed to dispatch system-wide notification", {
      error: error.message,
      notificationType,
      preferenceKey,
    });
  }
}

async function dispatchPersonal({
  employeeId,
  notificationType = "reminder",
  preferenceKey = PREFERENCE_KEYS.reminder,
  title,
  description = "",
  referenceType = null,
  referenceId = null,
}) {
  try {
    if (!employeeId) {
      return null;
    }

    const enabled = await isPreferenceEnabled(employeeId, preferenceKey);

    if (!enabled) {
      return null;
    }

    return createNotification({
      employeeId,
      notificationType,
      title,
      description,
      referenceType,
      referenceId,
    });
  } catch (error) {
    logger.warn("Failed to dispatch personal notification", {
      error: error.message,
      employeeId,
      notificationType,
    });
    return null;
  }
}

async function notifyOrderCreated({ orderNumber, companyName, orderId }) {
  await dispatchSystemWide({
    notificationType: "order",
    preferenceKey: PREFERENCE_KEYS.orderCreate,
    title: `New Order Added — ${orderNumber}`,
    description: companyName || "",
    referenceType: "Order",
    referenceId: orderId,
  });
}

async function notifyOrderStatusChange({
  orderNumber,
  details,
  orderId,
}) {
  await dispatchSystemWide({
    notificationType: "order",
    preferenceKey: PREFERENCE_KEYS.orderStatus,
    title: `Order Update — ${orderNumber}`,
    description: details || "",
    referenceType: "Order",
    referenceId: orderId,
  });
}

async function notifyInvoiceEvent({ title, description, invoiceId, orderId }) {
  await dispatchSystemWide({
    notificationType: "invoice",
    preferenceKey: PREFERENCE_KEYS.invoice,
    title,
    description: description || "",
    referenceType: invoiceId ? "Invoice" : "Order",
    referenceId: invoiceId || orderId || null,
  });
}

async function notifyActivityEvent({ title, description, referenceType, referenceId }) {
  await dispatchSystemWide({
    notificationType: "activity",
    preferenceKey: PREFERENCE_KEYS.activity,
    title,
    description: description || "",
    referenceType,
    referenceId,
  });
}

async function notifyFacilityEvent({ title, description, facilityId }) {
  await notifyActivityEvent({
    title,
    description,
    referenceType: "Facility",
    referenceId: facilityId,
  });
}

async function notifyReminder({
  employeeId,
  title,
  description = "",
  orderId,
  noteId = null,
}) {
  await dispatchPersonal({
    employeeId,
    notificationType: "reminder",
    preferenceKey: PREFERENCE_KEYS.reminder,
    title,
    description,
    referenceType: noteId ? "Reminder" : "Order",
    referenceId: noteId || orderId,
  });
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function syncDueReminderNotifications(employeeId, reminders = []) {
  const enabled = await isPreferenceEnabled(employeeId, PREFERENCE_KEYS.reminder);

  if (!enabled || !reminders.length) {
    return 0;
  }

  let created = 0;

  for (const reminder of reminders) {
    const noteId = reminder.noteId || reminder.note_id;

    if (!noteId) {
      continue;
    }

    const alreadyExists = await Notification.existsTodayForReference(employeeId, {
      referenceType: "Reminder",
      referenceId: noteId,
      notificationType: "reminder",
    });

    if (alreadyExists) {
      continue;
    }

    const orderLabel = reminder.orderNumber || reminder.caseNumber || "Order";
    const applicant = reminder.applicant || "";

    await dispatchPersonal({
      employeeId,
      notificationType: "reminder",
      preferenceKey: PREFERENCE_KEYS.reminder,
      title: `Reminder Due Today — ${orderLabel}`,
      description: applicant
        ? `${applicant}${reminder.note ? ` — ${reminder.note}` : ""}`
        : reminder.note || "",
      referenceType: "Reminder",
      referenceId: noteId,
    });

    created += 1;
  }

  return created;
}

async function getDueRemindersForUser(user) {
  const employeeId = user?.id;

  if (!employeeId) {
    return { reminders: [], enabled: false };
  }

  const enabled = await isPreferenceEnabled(employeeId, PREFERENCE_KEYS.reminder);

  if (!enabled) {
    return { reminders: [], enabled: false };
  }

  const rows = await Order.findDueRemindersOnDate({
    createdBy: employeeId,
    date: getTodayDateString(),
  });

  const reminders = rows.map((row) => ({
    noteId: row.note_id,
    orderId: row.order_id,
    orderNumber: row.order_number || "",
    caseNumber: row.case_number || row.order_number || "",
    applicant: [row.applicant_first_name, row.applicant_middle_name, row.applicant_last_name]
      .filter(Boolean)
      .join(" ")
      .trim(),
    note: row.note || "",
    callbackDate: row.callback_date,
    callbackDateDisplay: row.callback_date,
  }));

  await syncDueReminderNotifications(employeeId, reminders);

  return { reminders, enabled: true };
}

async function getNotificationsForEmployee(employeeId, query = {}) {
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 100;
  const rawType = query.type ? String(query.type).toLowerCase() : null;
  const typeFilter =
    rawType && NOTIFICATION_TYPES.includes(rawType) ? rawType : null;

  const rows = await Notification.findByEmployeeId(employeeId, {
    limit,
    type: typeFilter,
  });

  let notifications = rows.map(mapNotificationRow);

  if (query.search && `${query.search}`.trim()) {
    const term = sanitizeSearchText(query.search, { maxLength: 100 }).toLowerCase();
    if (!term) {
      const unreadCount = await Notification.countUnreadByEmployeeId(employeeId);
      return { notifications, unreadCount };
    }

    notifications = notifications.filter((item) => {
      return (
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.type.toLowerCase().includes(term)
      );
    });
  }

  const unreadCount = await Notification.countUnreadByEmployeeId(employeeId);

  return {
    notifications,
    unreadCount,
  };
}

async function markNotificationAsRead(notificationId, employeeId) {
  const updated = await Notification.markAsRead(notificationId, employeeId);

  if (!updated) {
    const existing = await Notification.findByIdForEmployee(
      notificationId,
      employeeId
    );

    if (!existing) {
      throw new ApiError(404, "Notification not found");
    }
  }

  const unreadCount = await Notification.countUnreadByEmployeeId(employeeId);

  return { unreadCount };
}

async function markAllNotificationsAsRead(employeeId) {
  await Notification.markAllAsRead(employeeId);
  return { unreadCount: 0 };
}

module.exports = {
  NOTIFICATION_TYPES,
  PREFERENCE_KEYS,
  notifyOrderCreated,
  notifyOrderStatusChange,
  notifyInvoiceEvent,
  notifyActivityEvent,
  notifyFacilityEvent,
  notifyReminder,
  syncDueReminderNotifications,
  getDueRemindersForUser,
  getNotificationsForEmployee,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  mapNotificationRow,
};
