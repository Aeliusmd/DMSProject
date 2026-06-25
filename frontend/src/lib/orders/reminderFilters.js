export function matchesReminderOrderId(reminder, orderIdQuery) {
  if (!orderIdQuery?.trim()) return true;

  const query = orderIdQuery.trim().toLowerCase();

  return (
    String(reminder.orderNumber || "")
      .toLowerCase()
      .includes(query) ||
    String(reminder.caseNumber || "")
      .toLowerCase()
      .includes(query) ||
    String(reminder.orderId || "")
      .toLowerCase()
      .includes(query)
  );
}

export function matchesPerformedBy(reminder, performedByQuery) {
  if (!performedByQuery?.trim()) return true;

  const query = performedByQuery.trim().toLowerCase();

  return String(reminder.by || "")
    .toLowerCase()
    .includes(query);
}

export function filterReminders(
  reminders = [],
  { orderId = "", performedBy = "" } = {}
) {
  return reminders.filter(
    (reminder) =>
      matchesReminderOrderId(reminder, orderId) &&
      matchesPerformedBy(reminder, performedBy)
  );
}
