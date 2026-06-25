/** Rush 1 = 2 weeks, Rush 2 = 3 weeks, Rush 3 = 4+ weeks since order created. */
const RUSH_1_MIN_DAYS = 14;
const RUSH_2_MIN_DAYS = 21;
const RUSH_3_MIN_DAYS = 28;

/** Active orders at Rush 2+ are treated as Ready (matches deriveDisplayOrderStatus). */
const RUSH_READY_MIN_DAYS = RUSH_2_MIN_DAYS;

function parseDateOnly(value) {
  if (!value) return null;

  const datePart = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;

  const [year, month, day] = datePart.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function toLocalOrderDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const parsed = parseDateOnly(value);
  if (parsed) return parsed;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getOrderAgeDays(createdAt) {
  const created = toLocalOrderDate(createdAt);
  if (!created) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
  );

  return diffDays < 0 ? null : diffDays;
}

/** Rush based on order age (created_at) — matches orders list / dashboard. */
function calculateOrderRushLevel(createdAt) {
  const diffDays = getOrderAgeDays(createdAt);
  if (diffDays == null) {
    return { level: null, label: null };
  }

  if (diffDays >= RUSH_3_MIN_DAYS) {
    return { level: 3, label: "Rush 3" };
  }

  if (diffDays >= RUSH_2_MIN_DAYS) {
    return { level: 2, label: "Rush 2" };
  }

  if (diffDays >= RUSH_1_MIN_DAYS) {
    return { level: 1, label: "Rush 1" };
  }

  return { level: null, label: null };
}

/** @deprecated Use calculateOrderRushLevel — rush is based on order created date. */
function calculateRushLevel(createdAt) {
  return calculateOrderRushLevel(createdAt).label;
}

module.exports = {
  RUSH_1_MIN_DAYS,
  RUSH_2_MIN_DAYS,
  RUSH_3_MIN_DAYS,
  RUSH_READY_MIN_DAYS,
  calculateOrderRushLevel,
  calculateRushLevel,
  parseDateOnly,
};
