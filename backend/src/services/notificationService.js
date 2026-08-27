const Notification = require("../models/Notification");
const Employee = require("../models/Employee");
const EmployeeSettings = require("../models/EmployeeSettings");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const { runNonCritical } = require("../utils/serviceErrorUtils");
const { sanitizeSearchText } = require("../utils/sanitize");
const { calendarTodayInTimezone, expandUtcInstantTokens, embedUtcInstantToken, endOfTodayUtc, toMysqlUtcDateTime, startOfCalendarDayUtc, formatUtcInstantDisplay } = require("../utils/timezoneUtils");
const config = require("../config");

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

function mapNotificationRow(row, timeZone = config.businessTimezone) {
  const createdAt = row.created_at;

  return {
    id: row.id,
    type: capitalizeType(row.notification_type),
    notificationType: row.notification_type,
    title: row.title || "",
    description: expandUtcInstantTokens(row.description || "", timeZone),
    time: formatRelativeTime(createdAt),
    read: Boolean(row.is_read),
    referenceType: row.reference_type || null,
    referenceId: row.reference_id || null,
    createdAt,
    readAt: row.read_at || null,
  };
}

/**
 * Older suspend notifications baked the actor's local time into `description`.
 * If the employee is still suspended, rewrite with a UTC token so viewers see
 * their own timezone.
 */
async function withRepairedSuspendDescriptions(rows = []) {
  const legacy = rows.filter(
    (row) =>
      String(row.title || "").toLowerCase() === "employee suspended" &&
      String(row.reference_type || "").toLowerCase() === "employee" &&
      row.reference_id &&
      !/\[\[utc:/i.test(String(row.description || ""))
  );

  if (!legacy.length) {
    return rows;
  }

  const employeeIds = [
    ...new Set(
      legacy
        .map((row) => Number(row.reference_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ];

  const reactivatedByEmployeeId = new Map();

  await Promise.all(
    employeeIds.map(async (id) => {
      const employee = await Employee.findById(id, { includeDeleted: true });
      if (employee?.reactivated_date && Number(employee.is_suspended)) {
        reactivatedByEmployeeId.set(id, {
          name: employee.name,
          token: embedUtcInstantToken(employee.reactivated_date),
        });
      }
    })
  );

  if (!reactivatedByEmployeeId.size) {
    return rows;
  }

  return rows.map((row) => {
    const meta = reactivatedByEmployeeId.get(Number(row.reference_id));
    if (!meta?.token) {
      return row;
    }

    if (
      String(row.title || "").toLowerCase() !== "employee suspended" ||
      /\[\[utc:/i.test(String(row.description || ""))
    ) {
      return row;
    }

    const nameMatch = String(row.description || "").match(
      /^(.+?)\s+was suspended until\s+/i
    );
    const name = nameMatch?.[1] || meta.name || "Employee";

    return {
      ...row,
      description: `${name} was suspended until ${meta.token}`,
    };
  });
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

  return runNonCritical(
    "Failed to create notification row",
    () =>
      Notification.create({
        employeeId,
        notificationType: normalizedType,
        title,
        description,
        referenceType,
        referenceId,
      }),
    logger
  );
}

async function dispatchSystemWide({
  notificationType,
  preferenceKey,
  title,
  description = "",
  referenceType = null,
  referenceId = null,
}) {
  return runNonCritical(
    "Failed to dispatch system-wide notification",
    async () => {
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
    },
    logger
  );
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
  return runNonCritical(
    "Failed to dispatch personal notification",
    async () => {
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
    },
    logger
  );
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

function getTodayDateString(timeZone = config.businessTimezone) {
  return calendarTodayInTimezone(timeZone);
}

async function syncDueReminderNotifications(employeeId, reminders = [], timeZone = config.businessTimezone) {
  const enabled = await isPreferenceEnabled(employeeId, PREFERENCE_KEYS.reminder);

  if (!enabled || !reminders.length) {
    return 0;
  }

  const dayStart = toMysqlUtcDateTime(startOfCalendarDayUtc(null, timeZone));
  const dayEnd = toMysqlUtcDateTime(endOfTodayUtc(timeZone));
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
      fromUtc: dayStart,
      toUtc: dayEnd,
    });

    if (alreadyExists) {
      continue;
    }

    const orderLabel = reminder.orderNumber || reminder.caseNumber || "Order";
    const applicant = reminder.applicant || "";
    const when = reminder.callbackDateDisplay
      ? ` (due ${reminder.callbackDateDisplay})`
      : "";

    await dispatchPersonal({
      employeeId,
      notificationType: "reminder",
      preferenceKey: PREFERENCE_KEYS.reminder,
      title: `Callback Reminder — ${orderLabel}`,
      description: applicant
        ? `${applicant}${when}${reminder.note ? ` — ${reminder.note}` : ""}`
        : `${reminder.note || "Callback due"}${when}`,
      referenceType: "Reminder",
      referenceId: noteId,
    });

    created += 1;
  }

  return created;
}

async function getDueRemindersForUser(user, { timezone } = {}) {
  const employeeId = user?.id;
  const timeZone = timezone || config.businessTimezone;

  if (!employeeId) {
    return { reminders: [], enabled: false };
  }

  const enabled = await isPreferenceEnabled(employeeId, PREFERENCE_KEYS.reminder);

  if (!enabled) {
    return { reminders: [], enabled: false };
  }

  const until = endOfTodayUtc(timeZone);
  const rows = await Order.findDueRemindersOnDate({
    createdBy: employeeId,
    untilUtc: toMysqlUtcDateTime(until),
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
    callbackAt: row.callback_date,
    callbackDateDisplay: formatUtcInstantDisplay(row.callback_date, timeZone) || "",
  }));

  await syncDueReminderNotifications(employeeId, reminders, timeZone);

  return { reminders, enabled: true };
}

async function getNotificationsForEmployee(employeeId, query = {}, options = {}) {
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 100;
  const rawType = query.type ? String(query.type).toLowerCase() : null;
  const typeFilter =
    rawType && NOTIFICATION_TYPES.includes(rawType) ? rawType : null;
  const timeZone = options.timezone || config.businessTimezone || "UTC";

  const rows = await Notification.findByEmployeeId(employeeId, {
    limit,
    type: typeFilter,
  });

  const repairedRows = await withRepairedSuspendDescriptions(rows);
  let notifications = repairedRows.map((row) =>
    mapNotificationRow(row, timeZone)
  );

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
