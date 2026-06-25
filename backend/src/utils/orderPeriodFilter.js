const ALLOWED_ORDER_PERIODS = new Set(["1w", "2w", "3w", "4w", "2m", "3m"]);

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveOrderPeriodStartDate(period) {
  if (!period || !ALLOWED_ORDER_PERIODS.has(period)) {
    return null;
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case "1w":
      start.setDate(start.getDate() - 7);
      break;
    case "2w":
      start.setDate(start.getDate() - 14);
      break;
    case "3w":
      start.setDate(start.getDate() - 21);
      break;
    case "4w":
      start.setDate(start.getDate() - 28);
      break;
    case "2m":
      start.setMonth(start.getMonth() - 2);
      break;
    case "3m":
      start.setMonth(start.getMonth() - 3);
      break;
    default:
      return null;
  }

  return formatLocalDate(start);
}

module.exports = {
  ALLOWED_ORDER_PERIODS,
  resolveOrderPeriodStartDate,
};
