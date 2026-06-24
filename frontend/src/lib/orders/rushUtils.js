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

export function deriveDisplayOrderStatus(status, createdAt) {
  if (status === "Ready" || status === "Ready to Pickup") {
    return status;
  }

  const rush = calculateOrderRushLevel(createdAt);
  if (status === "Active" && (rush === "Rush 2" || rush === "Rush 3")) {
    return "Ready";
  }

  return status || "Active";
}

/** @deprecated Use calculateOrderRushLevel — rush is based on order created date. */
export function calculateRushLevel(createdAt) {
  return calculateOrderRushLevel(createdAt);
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
