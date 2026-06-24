export const ORDER_RECORD_TYPES = [
  { key: "medicalRecords", label: "Medical Records", orderType: "medical" },
  { key: "billingRecords", label: "Billing Records", orderType: "billing" },
  { key: "employmentRecords", label: "Employment Records", orderType: "employment" },
  { key: "xrays", label: "X-Rays", orderType: "xrays" },
  { key: "otherRecord", label: "Other", orderType: "other" },
];

export const ORDER_TYPE_LABELS = {
  medical: "Medical Records",
  billing: "Billing Records",
  employment: "Employment Records",
  xrays: "X-Rays",
  other: "Other",
};

export const ORDER_TYPE_TO_RECORD_FLAG = {
  medical: "medicalRecords",
  billing: "billingRecords",
  employment: "employmentRecords",
  xrays: "xrays",
  other: "otherRecord",
};

export function getOrderTypeLabel(orderType = "") {
  return ORDER_TYPE_LABELS[orderType] || "";
}

export function getSavedOrderRecordTypeLabel(order = {}) {
  const orderType = order.type || "";
  return getOrderTypeLabel(orderType);
}
