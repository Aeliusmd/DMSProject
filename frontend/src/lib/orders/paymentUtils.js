export const PAYMENT_CHARGE_AMOUNTS = {
  prepayment: 15,
  custodian: 15,
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
