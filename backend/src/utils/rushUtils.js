function parseDateOnly(value) {
  if (!value) return null;

  const datePart = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;

  const [year, month, day] = datePart.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

/** Rush based on order age (created_at) — matches orders list / dashboard. */
function calculateOrderRushLevel(createdAt) {
  if (!createdAt) {
    return { level: null, label: null };
  }

  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return { level: null, label: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  created.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return { level: null, label: null };
  }

  const weeks = Math.floor(diffDays / 7);

  if (weeks < 2) {
    return { level: 1, label: "Rush 1" };
  }

  if (weeks === 2) {
    return { level: 2, label: "Rush 2" };
  }

  return { level: 3, label: "Rush 3" };
}

/** Rush based on subpoena date — used for invoice display. */
function calculateRushLevel(dateValue) {
  const orderDate = parseDateOnly(dateValue);
  if (!orderDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffInMs = today.getTime() - orderDate.getTime();
  const daysOld = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (daysOld < 0) return null;
  if (daysOld <= 7) return "Rush 3";
  if (daysOld <= 21) return "Rush 2";

  return "Rush 1";
}

module.exports = {
  calculateOrderRushLevel,
  calculateRushLevel,
  parseDateOnly,
};
