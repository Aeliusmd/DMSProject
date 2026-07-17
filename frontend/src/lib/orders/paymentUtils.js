export const PAYMENT_CHARGE_AMOUNTS = {
  prepayment: 15,
  // Legacy field — no longer billed separately (was double-counting the $15).
  custodian: 0,
  xray: 0,
};

/** Flat records fee billed once records are located (not charged for CNR). */
export const QUICK_RECORDS_FEE = 20;

/** Full request total when both witness fee + records fee apply. */
export const REQUEST_TOTAL_WITH_RECORDS_FEE =
  PAYMENT_CHARGE_AMOUNTS.prepayment + QUICK_RECORDS_FEE;

export function isQuickRecordsFeeInvoice(fees = {}) {
  const storageFee = parsePaymentAmount(fees.storageFee ?? fees.storage_fee);
  const pages = Math.max(0, Math.floor(parsePaymentAmount(fees.pages ?? fees.page_count)));
  const perPageAmount = parsePaymentAmount(
    fees.perPageAmount ?? fees.per_page_amount
  );
  const clericalHours = parsePaymentAmount(
    fees.clericalTimeHours ?? fees.clerical_time_hours
  );
  const clericalRate = parsePaymentAmount(
    fees.clericalHourlyRate ?? fees.clerical_hourly_rate
  );
  const shipping = parsePaymentAmount(
    fees.shippingHandling ?? fees.shipping_handling
  );

  return (
    storageFee === QUICK_RECORDS_FEE &&
    pages === 0 &&
    perPageAmount === 0 &&
    clericalHours === 0 &&
    clericalRate === 0 &&
    shipping === 0
  );
}

export function parsePaymentAmount(value) {
  return Number(String(value ?? "").replace(/[^\d.]/g, "")) || 0;
}

export function getPaymentLineAmount(paymentLines = [], type) {
  const line = paymentLines.find((entry) => entry.type === type);
  return parsePaymentAmount(line?.amount);
}

export function formatPaidBracket(paidAmount) {
  const paid = parsePaymentAmount(paidAmount);
  if (paid <= 0) return null;
  return `(${formatMoneyAmount(paid)})`;
}

export function feeAmountFromDue(dueAmount, paidAmount) {
  return parsePaymentAmount(dueAmount) + parsePaymentAmount(paidAmount);
}

export function dueAmountFromFee(feeAmount, paidAmount) {
  return Math.max(0, parsePaymentAmount(feeAmount) - parsePaymentAmount(paidAmount));
}

export function dueMoneyInputFromFee(feeAmount, paidAmount) {
  return dueAmountFromFee(feeAmount, paidAmount).toFixed(2);
}

export function mapInvoiceFeesToDueForm(feeFormData) {
  return {
    ...feeFormData,
    storageFee: parsePaymentAmount(feeFormData.storageFee).toFixed(2),
  };
}

export function mapDueFormToInvoiceFees(formData) {
  return {
    ...formData,
    storageFee: parsePaymentAmount(formData.storageFee).toFixed(2),
  };
}

export function resolveFullFeeAmounts(formData) {
  return {
    storageFee: parsePaymentAmount(formData.storageFee),
  };
}

export function formatPaymentDue(chargeAmount, paidValue, options = {}) {
  const paid = parsePaymentAmount(paidValue);
  const charge = parsePaymentAmount(chargeAmount);

  if (options.useInvoiceFees) {
    return formatMoneyAmount(Math.max(0, charge - paid));
  }

  if (paid <= 0) {
    return formatMoneyAmount(charge);
  }

  return formatMoneyAmount(Math.max(0, charge - paid));
}

export function getPaymentChargeForType(type, invoiceFees = {}) {
  if (type === "xray" && invoiceFees?.hasXrayInvoice) {
    return parsePaymentAmount(invoiceFees.xrayFee);
  }

  return PAYMENT_CHARGE_AMOUNTS[type] ?? 0;
}

export function resolveCustodianDue(_invoiceFees = {}, custodianPaid = 0) {
  return dueAmountFromFee(PAYMENT_CHARGE_AMOUNTS.custodian, custodianPaid);
}

export function resolveXrayDue(invoiceFees = {}, xrayPaid = 0) {
  const charge = invoiceFees?.hasXrayInvoice
    ? parsePaymentAmount(invoiceFees.xrayFee)
    : parsePaymentAmount(invoiceFees?.xrayFee);

  return dueAmountFromFee(charge, xrayPaid);
}

export function getPaymentTotalOwed(type, invoiceFees = {}, storedDue = "") {
  if (type === "xray") {
    return resolvePaymentDue(type, invoiceFees, 0);
  }

  if (type === "custodian" || type === "prepayment") {
    return getPaymentChargeForType(type, invoiceFees);
  }

  const charge = resolvePaymentCharge(type, invoiceFees, 0, storedDue);
  return dueAmountFromFee(charge, 0);
}

export function capPaymentPaidEntry(
  type,
  invoiceFees = {},
  currentPaid = 0,
  storedDue = "",
  rawValue = ""
) {
  if (type !== "custodian" && type !== "xray") {
    return { paidValue: rawValue, capped: false };
  }

  if (rawValue === "") {
    return { paidValue: "", capped: false };
  }

  const totalOwed = getPaymentTotalOwed(type, invoiceFees, storedDue);
  const entered = parsePaymentAmount(rawValue);

  if (entered <= totalOwed) {
    return { paidValue: rawValue, capped: false };
  }

  return {
    paidValue: totalOwed > 0 ? totalOwed.toFixed(2) : "0.00",
    capped: true,
  };
}

export function validateOrderPaymentAmounts(data = {}, invoiceFees = {}) {
  const errors = {};

  validatePaymentPaidCap(errors, "xray", data, invoiceFees);

  return errors;
}

function validatePaymentPaidCap(errors, prefix, data, invoiceFees) {
  const paidField = `${prefix}Paid`;
  const rawPaid = data[paidField];

  if (!rawPaid) {
    return;
  }

  const paid = parsePaymentAmount(rawPaid);
  const totalOwed = getPaymentTotalOwed(
    prefix,
    invoiceFees,
    data[`${prefix}Due`]
  );

  if (paid > totalOwed) {
    errors[paidField] = "Paid cannot exceed due";
  }
}

export function resolvePaymentCharge(type, invoiceFees = {}, paidValue = 0, dueValue = 0) {
  if (type === "xray" && invoiceFees?.hasXrayInvoice) {
    return getPaymentChargeForType(type, invoiceFees);
  }

  if (type === "custodian" || type === "prepayment") {
    return getPaymentChargeForType(type, invoiceFees);
  }

  const paid = parsePaymentAmount(paidValue);
  const due = parsePaymentAmount(dueValue);
  return paid + due;
}

export function resolvePaymentDue(type, invoiceFees = {}, paidValue = 0) {
  if (type === "xray" && invoiceFees?.hasXrayInvoice) {
    return resolveXrayDue(invoiceFees, paidValue);
  }

  const charge = getPaymentChargeForType(type, invoiceFees);
  return dueAmountFromFee(charge, paidValue);
}

export function syncPaymentDueFields(formData, invoiceFees = formData?.invoiceFees || {}) {
  const next = { ...formData };

  const prepaymentCharge = getPaymentChargeForType("prepayment", invoiceFees);
  next.prepaymentDue = dueAmountFromFee(
    prepaymentCharge,
    formData.prepaymentPaid
  ).toFixed(2);

  if (!formData.certificateNoRecords && invoiceFees?.hasXrayInvoice) {
    next.xrayDue = resolveXrayDue(invoiceFees, formData.xrayPaid).toFixed(2);
  } else if (formData.xrayDue === "" || formData.xrayDue === undefined) {
    const charge = resolvePaymentCharge(
      "xray",
      invoiceFees,
      formData.xrayPaid,
      formData.xrayDue
    );
    next.xrayDue = dueAmountFromFee(charge, formData.xrayPaid).toFixed(2);
  }

  return next;
}

export function deriveInvoiceStatusLabel(totalAmount, amountPaid, writeoffAmount = 0) {
  const total = parsePaymentAmount(totalAmount);
  const paid = parsePaymentAmount(amountPaid);
  const writeoff = parsePaymentAmount(writeoffAmount);
  const amountDue = Math.max(0, total - paid - writeoff);

  if (amountDue <= 0) {
    if (paid >= total) {
      return "Paid";
    }

    if (writeoff > 0 && paid < total) {
      return "Written Off";
    }

    return paid > 0 ? "Paid" : writeoff > 0 ? "Written Off" : "Unpaid";
  }

  if (paid <= 0) {
    return "Unpaid";
  }

  return "Partial";
}

export function resolveInvoiceAmounts(totalAmount, amountPaid, writeoffAmount = 0) {
  const total = parsePaymentAmount(totalAmount);
  const paid = parsePaymentAmount(amountPaid);
  const writeoff = parsePaymentAmount(writeoffAmount);
  const amountDue = Math.max(0, total - paid - writeoff);

  const status = deriveInvoiceStatusLabel(total, paid, writeoff);

  return {
    total,
    amountPaid: paid,
    writeoffAmount: writeoff,
    amountDue,
    status,
    overpayment: Math.max(0, paid - total),
  };
}

export function resolvePersistedInvoiceAmounts(
  totalAmount,
  amountPaid,
  { writeoffAmount = 0, persistedStatus = null } = {}
) {
  const totals = resolveInvoiceAmounts(totalAmount, amountPaid, writeoffAmount);

  if (persistedStatus === "Needs Resend") {
    return { ...totals, status: "Needs Resend" };
  }

  if (persistedStatus === "Written Off" && totals.amountDue <= 0) {
    return { ...totals, status: "Written Off" };
  }

  return totals;
}

export function formatMoneyAmount(value) {
  const amount = parsePaymentAmount(value);
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const ORDER_PAYMENT_SUMMARY_LINES = [
  { type: "prepayment", label: "Prepayment", field: "prepaymentPaid" },
  { type: "custodian", label: "Custodian", field: "custodianPaid" },
  { type: "xray", label: "X-Ray", field: "xrayPaid" },
];

export function buildPaymentLinesFromOrder(order = {}) {
  return ORDER_PAYMENT_SUMMARY_LINES.map(({ type, label, field }) => {
    const amount = parsePaymentAmount(order[field]);
    if (amount <= 0) return null;

    return {
      type,
      label,
      amount,
      bracketLabel: `${label} (${formatMoneyAmount(amount)})`,
    };
  }).filter(Boolean);
}
