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

export function buildRecordTypeFormUpdates(selectedTypes = []) {
  const selected = new Set(selectedTypes);
  const updates = {};

  for (const recordType of ORDER_RECORD_TYPES) {
    updates[recordType.key] = selected.has(recordType.orderType);
  }

  updates.type = selectedTypes[0] || "";
  return updates;
}

export function getSelectedRecordTypesFromForm(formData = {}) {
  return ORDER_RECORD_TYPES.filter((recordType) =>
    Boolean(formData[recordType.key])
  ).map((recordType) => recordType.orderType);
}

export function hasFormRecordTypesSelected(formData = {}) {
  return getSelectedRecordTypesFromForm(formData).length > 0;
}

export function formatSelectedRecordTypesLabel(formData = {}) {
  return getSelectedRecordTypesFromForm(formData)
    .map((orderType) => getOrderTypeLabel(orderType))
    .join(", ");
}

export function getOrderTypeLabel(orderType = "") {
  return ORDER_TYPE_LABELS[orderType] || "";
}

export function getSavedOrderRecordTypeLabel(order = {}) {
  const slots = getOrderRecordSlots(order);
  if (!slots.length) return "";
  if (slots.length === 1) return slots[0].label;
  return slots.map((slot) => slot.label).join(", ");
}

export function getOrderRecordSlots(order = {}) {
  if (Array.isArray(order.orderRecords) && order.orderRecords.length) {
    return order.orderRecords.map((record) => ({
      recordType: record.recordType,
      label: getOrderTypeLabel(record.recordType),
      hasFile: Boolean(record.hasFile),
      storagePath: record.storagePath || null,
      storageUrl: record.storageUrl || null,
    }));
  }

  return ORDER_RECORD_TYPES.filter((recordType) => Boolean(order[recordType.key])).map(
    (recordType) => ({
      recordType: recordType.orderType,
      label: recordType.label,
      hasFile: false,
      storagePath: null,
      storageUrl: null,
    })
  );
}

export function allOrderRecordSlotsUploaded(order = {}) {
  const slots = getOrderRecordSlots(order);
  if (!slots.length) return false;
  return slots.every((slot) => slot.hasFile);
}

export function anyOrderRecordSlotUploaded(order = {}) {
  return getOrderRecordSlots(order).some((slot) => slot.hasFile);
}

export function getOrderRecordsForMail(order = {}) {
  if (!order) return [];

  return getOrderRecordSlots({
    ...order,
    orderRecords: order.records?.orderRecords || order.orderRecords,
  });
}

export function formatRecordTypesPhrase(labels = []) {
  const cleaned = labels.filter(Boolean);
  if (!cleaned.length) return "records";

  const lower = cleaned.map((label) => label.toLowerCase());
  if (lower.length === 1) return lower[0];
  if (lower.length === 2) return `${lower[0]} and ${lower[1]}`;
  return `${lower.slice(0, -1).join(", ")}, and ${lower[lower.length - 1]}`;
}

export function buildOrderMailDefaultBody(order = {}) {
  if (!order) return "";

  const orderNumber = order.id || order.dbId || "";
  const uploadedSlots = getOrderRecordsForMail(order).filter((slot) => slot.hasFile);
  const labels = uploadedSlots.map((slot) => slot.label);
  const recordsPhrase = formatRecordTypesPhrase(labels);
  const sentenceStart =
    recordsPhrase.charAt(0).toUpperCase() + recordsPhrase.slice(1);
  const attachmentPhrase =
    labels.length > 1
      ? `The ${recordsPhrase} PDFs are attached to this email.`
      : `The ${recordsPhrase} PDF is attached to this email.`;

  const lines = [
    "Hello,",
    "",
    `${sentenceStart} for order ${orderNumber} are ready.`,
  ];

  if (order.applicant) {
    lines.push(`Applicant: ${order.applicant}`);
  }

  if (order.providerName) {
    lines.push(`Provider: ${order.providerName}`);
  }

  lines.push(
    attachmentPhrase,
    "",
    "Please contact us if you have any questions.",
    "",
    "DMS Custodian"
  );

  return lines.join("\n");
}
