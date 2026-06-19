/** Rush based on order age (created_at) — matches orders list / dashboard / reports. */
export function calculateOrderRushLevel(createdAt) {
  if (!createdAt) return null;

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  created.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return null;

  const weeks = Math.floor(diffDays / 7);

  if (weeks < 2) return "Rush 1";
  if (weeks === 2) return "Rush 2";
  return "Rush 3";
}

/** Rush based on subpoena date — used for invoice display. */
export function calculateRushLevel(dateValue) {
  if (!dateValue) return null;

  const orderDate = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(orderDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffInMs = today.getTime() - orderDate.getTime();
  const daysOld = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (daysOld < 0) return null;
  if (daysOld <= 7) return "Rush 3";
  if (daysOld <= 21) return "Rush 2";

  return "Rush 1";
}

export const RUSH_LEVEL_STYLES = {
  "Rush 1": "border-[#FDE68A] bg-[#FEF3C7] text-[#B45309]",
  "Rush 2": "border-[#FDBA74] bg-[#FFEDD5] text-[#EA580C]",
  "Rush 3": "border-[#FCA5A5] bg-[#FEE2E2] text-[#DC2626]",
};

export const RUSH_LEVEL_LEGEND = [
  { color: "#EAB308", label: "Rush 1" },
  { color: "#F97316", label: "Rush 2" },
  { color: "#EF4444", label: "Rush 3" },
];
