export const PAYMENT_CHARGE_AMOUNTS = {
  prepayment: 15,
  custodian: 15,
  xray: 0,
};

export function parsePaymentAmount(value) {
  return Number(String(value ?? "").replace(/[^\d.]/g, "")) || 0;
}

export function formatPaymentDue(chargeAmount, paidValue, options = {}) {
  const paid = parsePaymentAmount(paidValue);
  const charge = parsePaymentAmount(chargeAmount);

  if (options.useInvoiceFees) {
    return formatMoneyAmount(Math.max(0, charge - paid));
  }

  if (paid <= 0) return "$0.00";

  return formatMoneyAmount(Math.max(0, charge - paid));
}

export function getPaymentChargeForType(type, invoiceFees) {
  if (invoiceFees?.hasInvoice) {
    if (type === "custodian") return parsePaymentAmount(invoiceFees.custodianFee);
    if (type === "xray") return parsePaymentAmount(invoiceFees.xrayFee);
  }

  return PAYMENT_CHARGE_AMOUNTS[type] ?? 0;
}

export function deriveInvoiceStatusLabel(totalAmount, amountPaid) {
  const total = parsePaymentAmount(totalAmount);
  const paid = parsePaymentAmount(amountPaid);

  if (paid <= 0) return "Unpaid";
  if (total <= 0 || paid >= total) return "Paid";
  return "Partial";
}

export function resolveInvoiceAmounts(totalAmount, amountPaid) {
  const total = parsePaymentAmount(totalAmount);
  const paid = parsePaymentAmount(amountPaid);
  const amountDue = Math.max(0, total - paid);
  const overpayment = Math.max(0, paid - total);
  const status = deriveInvoiceStatusLabel(total, paid);

  return {
    amountDue,
    overpayment,
    status,
    isOverpaid: overpayment > 0,
  };
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
