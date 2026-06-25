export const ORDER_PERIOD_OPTIONS = [
  { value: "", label: "All Time" },
  { value: "1w", label: "Past 1 Week" },
  { value: "2w", label: "Past 2 Weeks" },
  { value: "3w", label: "Past 3 Weeks" },
  { value: "4w", label: "Past 4 Weeks" },
  { value: "2m", label: "Past 2 Months" },
  { value: "3m", label: "Past 3 Months" },
];

export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getOrderPeriodStartDate(period) {
  if (!period) return null;

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
