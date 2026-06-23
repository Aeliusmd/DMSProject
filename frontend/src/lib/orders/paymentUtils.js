export const PAYMENT_CHARGE_AMOUNTS = {
  prepayment: 15,
  custodian: 0,
  xray: 0,
};

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

export function mapInvoiceFeesToDueForm(feeFormData, paymentLines = []) {
  const custodianPaid = getPaymentLineAmount(paymentLines, "custodian");

  return {
    ...feeFormData,
    custodianFee: dueMoneyInputFromFee(feeFormData.custodianFee, custodianPaid),
  };
}

export function mapDueFormToInvoiceFees(formData, paymentLines = []) {
  const custodianPaid = getPaymentLineAmount(paymentLines, "custodian");

  return {
    ...formData,
    custodianFee: feeAmountFromDue(formData.custodianFee, custodianPaid).toFixed(2),
    storageFee: parsePaymentAmount(formData.storageFee).toFixed(2),
  };
}

export function resolveFullFeeAmounts(formData, paymentLines = []) {
  const custodianPaid = getPaymentLineAmount(paymentLines, "custodian");

  return {
    custodianFee: feeAmountFromDue(formData.custodianFee, custodianPaid),
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
  if (type === "custodian" && invoiceFees?.hasInvoice) {
    return parsePaymentAmount(invoiceFees.custodianFee);
  }

  if (type === "xray" && invoiceFees?.hasXrayInvoice) {
    return parsePaymentAmount(invoiceFees.xrayFee);
  }

  return PAYMENT_CHARGE_AMOUNTS[type] ?? 0;
}

export function resolveCustodianDue(invoiceFees = {}, custodianPaid = 0) {
  if (!invoiceFees?.hasInvoice) {
    return dueAmountFromFee(
      parsePaymentAmount(invoiceFees?.custodianFee),
      custodianPaid
    );
  }

  const paid = parsePaymentAmount(custodianPaid);
  const custodianFee = parsePaymentAmount(invoiceFees.custodianFee);

  if (custodianFee <= 0) {
    return 0;
  }

  if (paid >= custodianFee) {
    return 0;
  }

  const prepayment = parsePaymentAmount(invoiceFees.prepaymentPaid);
  const writeoff = parsePaymentAmount(invoiceFees.writeoffAmount);
  const nonCustodianBalance = Math.max(
    0,
    parsePaymentAmount(invoiceFees.nonCustodianTotal) ||
      parsePaymentAmount(invoiceFees.invoiceTotal) - custodianFee
  );
  const creditsApplied = prepayment + writeoff;
  const excessOverNonCustodian = Math.max(0, creditsApplied - nonCustodianBalance);

  return Math.max(0, custodianFee - paid - excessOverNonCustodian);
}

export function resolveXrayDue(invoiceFees = {}, xrayPaid = 0) {
  const charge = invoiceFees?.hasXrayInvoice
    ? parsePaymentAmount(invoiceFees.xrayFee)
    : parsePaymentAmount(invoiceFees?.xrayFee);

  return dueAmountFromFee(charge, xrayPaid);
}

export function getPaymentTotalOwed(type, invoiceFees = {}, storedDue = "") {
  if (type === "custodian" || type === "xray") {
    return resolvePaymentDue(type, invoiceFees, 0);
  }

  const charge = resolvePaymentCharge(
    type,
    invoiceFees,
    0,
    storedDue
  );

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

  if (!data.certificateNoRecords) {
    validatePaymentPaidCap(errors, "custodian", data, invoiceFees);
  }

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
  const invoiceCharge = getPaymentChargeForType(type, invoiceFees);

  if (type === "custodian" && invoiceFees?.hasInvoice) {
    return invoiceCharge;
  }

  if (type === "xray" && invoiceFees?.hasXrayInvoice) {
    return invoiceCharge;
  }

  const paid = parsePaymentAmount(paidValue);
  const due = parsePaymentAmount(dueValue);
  return paid + due;
}

export function resolvePaymentDue(type, invoiceFees = {}, paidValue = 0) {
  if (type === "custodian" && invoiceFees?.hasInvoice) {
    return resolveCustodianDue(invoiceFees, paidValue);
  }

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

  const targets = [
    { prefix: "custodian", hasFee: Boolean(invoiceFees?.hasInvoice) },
    { prefix: "xray", hasFee: Boolean(invoiceFees?.hasXrayInvoice) },
  ];

  for (const { prefix, hasFee } of targets) {
    if (prefix === "custodian" && formData.certificateNoRecords) {
      continue;
    }

    const paid = formData[`${prefix}Paid`];
    const storedDue = formData[`${prefix}Due`];

    if (hasFee) {
      if (prefix === "custodian") {
        next[`${prefix}Due`] = resolveCustodianDue(invoiceFees, paid).toFixed(2);
        continue;
      }

      if (prefix === "xray") {
        next[`${prefix}Due`] = resolveXrayDue(invoiceFees, paid).toFixed(2);
        continue;
      }

      const charge = getPaymentChargeForType(prefix, invoiceFees);
      next[`${prefix}Due`] = dueAmountFromFee(charge, paid).toFixed(2);
      continue;
    }

    const charge = resolvePaymentCharge(prefix, invoiceFees, paid, storedDue);
    next[`${prefix}Due`] = dueAmountFromFee(charge, paid).toFixed(2);
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
  const overpayment = Math.max(0, paid - total);
  const status = deriveInvoiceStatusLabel(total, paid, writeoff);

  return {
    amountDue,
    overpayment,
    status,
    isOverpaid: overpayment > 0,
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

export function formatMoneyAmount(amount) {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const ORDER_PAYMENT_FIELDS = [
  { type: "prepayment", label: "Prepayment", field: "prepaymentPaid" },
  { type: "custodian", label: "Custodian", field: "custodianPaid" },
  { type: "xray", label: "X-Ray Fee", field: "xrayPaid" },
];

export function buildPaymentLinesFromOrder(orderData) {
  if (Array.isArray(orderData?.paymentLines) && orderData.paymentLines.length) {
    return orderData.paymentLines;
  }

  return ORDER_PAYMENT_FIELDS.reduce((lines, { type, label, field }) => {
    const amount = parsePaymentAmount(orderData?.[field]);
    if (amount <= 0) return lines;

    lines.push({
      type,
      label,
      amount,
      bracketLabel: `${label} (${formatMoneyAmount(amount)})`,
    });

    return lines;
  }, []);
}

export function sumPaymentLineAmounts(paymentLines = []) {
  return paymentLines.reduce(
    (sum, line) => sum + parsePaymentAmount(line?.amount),
    0
  );
}
