import { useState } from "react";
import NewOrderField from "@/components/orders/new-order/NewOrderField";
import {
  capPaymentPaidEntry,
  dueAmountFromFee,
  formatMoneyAmount,
  formatPaidBracket,
  parsePaymentAmount,
  resolvePaymentDue,
  resolvePaymentCharge,
} from "@/lib/orders/paymentUtils";

const paymentThemes = {
  green: {
    border: "border-[#86EFAC]",
    bg: "bg-[#ECFDF5]",
    title: "text-[#047857]",
    due: "text-[#0F766E]",
  },
  purple: {
    border: "border-[#DDD6FE]",
    bg: "bg-[#F5F3FF]",
    title: "text-[#7C3AED]",
    due: "text-[#7C3AED]",
  },
  blue: {
    border: "border-[#BFDBFE]",
    bg: "bg-[#EFF6FF]",
    title: "text-[#2563EB]",
    due: "text-[#2563EB]",
  },
};

function sanitizeMoneyInput(value) {
  return String(value ?? "")
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1")
    .replace(/^(\d*\.\d{0,2}).*$/, "$1");
}

function AmountField({ label, value, onChange, onBlur, readOnly, colors, error }) {
  return (
    <div>
      <p className="mb-[6px] text-[11px] font-semibold text-[#475569]">{label}</p>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        readOnly={readOnly}
        placeholder="0.00"
        className={`flex h-[38px] w-full items-center rounded-[6px] border px-3 text-[14px] font-semibold outline-none focus:ring-2 ${colors.due} ${
          readOnly
            ? "cursor-not-allowed border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]"
            : error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
              : "border-[#CBD5E1] bg-white focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
      />
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function usesInvoiceDueRules(type, invoiceFees) {
  return (
    (type === "custodian" && invoiceFees?.hasInvoice) ||
    (type === "xray" && invoiceFees?.hasXrayInvoice)
  );
}

export default function PaymentChargeCard({
  title,
  chargeAmount,
  paidAmount = 0,
  theme = "green",
  prefix,
  formData,
  onChange,
  onBlur,
  getError,
  showPaidField = false,
  mirrorPaidDue = false,
  amountsReadOnly = false,
  paidReadOnly,
  fieldsReadOnly = false,
  chargeAmountFieldName = "",
  chargeAmountLabel = "Amount",
  autoDueOnPaidChange = false,
  invoiceFees = null,
  paymentType = "",
  capPaidToDue = false,
  onValuesChange,
  checkLabel = "Check #",
  checkPlaceholder = "Check number",
  checkDisplayValue = null,
  checkReadOnly = false,
  checkAllowAnyChars = false,
}) {
  const colors = paymentThemes[theme];
  const [paidCapError, setPaidCapError] = useState("");
  const lockPaid = paidReadOnly ?? amountsReadOnly;
  const lockFields = fieldsReadOnly || lockPaid;
  const lockCheck = checkReadOnly || lockFields;
  const dueFieldName = `${prefix}Due`;
  const type = paymentType || prefix;
  const invoiceLinkedDue = usesInvoiceDueRules(type, invoiceFees);
  const autoComputeDue = autoDueOnPaidChange || invoiceLinkedDue;

  const resolvedPaid = showPaidField
    ? parsePaymentAmount(formData[`${prefix}Paid`])
    : parsePaymentAmount(paidAmount);
  const storedDue = formData[dueFieldName];
  const charge = chargeAmountFieldName
    ? parsePaymentAmount(formData[chargeAmountFieldName] || chargeAmount)
    : resolvePaymentCharge(type, invoiceFees, resolvedPaid, storedDue);
  const paid = resolvedPaid;
  const paidBracket = formatPaidBracket(paid);
  const computedDue = invoiceLinkedDue
    ? resolvePaymentDue(type, invoiceFees, resolvedPaid)
    : mirrorPaidDue
      ? charge
      : dueAmountFromFee(charge, resolvedPaid);
  const paidDisplay = mirrorPaidDue ? charge : paid;

  const emitValues = (updates) => {
    if (onValuesChange) {
      onValuesChange(updates);
      return;
    }

    Object.entries(updates).forEach(([name, value]) => {
      onChange({ target: { name, value } });
    });
  };

  const handlePaidChange = (event) => {
    if (lockPaid) return;

    const rawPaid = sanitizeMoneyInput(event.target.value);
    let nextPaid = rawPaid;

    if (capPaidToDue) {
      const { paidValue, capped } = capPaymentPaidEntry(
        type,
        invoiceFees,
        resolvedPaid,
        storedDue,
        rawPaid
      );
      nextPaid = paidValue;
      setPaidCapError(capped ? "Paid cannot exceed due" : "");
    } else {
      setPaidCapError("");
    }

    const updates = { [`${prefix}Paid`]: nextPaid };

    if (autoComputeDue) {
      updates[dueFieldName] = resolvePaymentDue(
        type,
        invoiceFees,
        nextPaid
      ).toFixed(2);
    }

    emitValues(updates);
  };

  const dueDisplayValue = autoComputeDue
    ? computedDue.toFixed(2)
    : mirrorPaidDue
      ? charge.toFixed(2)
      : dueAmountFromFee(charge, paid).toFixed(2);

  return (
    <div className={`rounded-[10px] border ${colors.border} ${colors.bg} p-4`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className={`text-[14px] font-semibold ${colors.title}`}>
            {title}
            {paidBracket ? ` ${paidBracket}` : ""}
          </h3>
          <p className={`mt-[2px] text-[11px] ${colors.title}`}>
            Charge: {formatMoneyAmount(charge)}
          </p>
        </div>

        <button
          type="button"
          className={`text-[12px] font-semibold ${colors.title}`}
        >
          New
        </button>
      </div>

      <div className="space-y-3">
        {chargeAmountFieldName && (
          <AmountField
            label={chargeAmountLabel}
            value={formData[chargeAmountFieldName] ?? ""}
            onChange={(event) => {
              emitValues({
                [chargeAmountFieldName]: sanitizeMoneyInput(event.target.value),
              });
            }}
            onBlur={onBlur}
            readOnly={false}
            colors={colors}
            error={getError(chargeAmountFieldName)}
          />
        )}

        <NewOrderField
          label={checkLabel}
          name={`${prefix}Check`}
          value={
            checkDisplayValue !== null && checkDisplayValue !== undefined
              ? checkDisplayValue
              : formData[`${prefix}Check`]
          }
          onChange={onChange}
          onBlur={onBlur}
          placeholder={checkPlaceholder}
          disabled={lockCheck}
          inputMode={checkReadOnly || checkAllowAnyChars ? "text" : "numeric"}
          maxLength={checkReadOnly || checkAllowAnyChars ? 50 : 12}
          error={getError(`${prefix}Check`)}
        />

        <NewOrderField
          label="Check Date"
          name={`${prefix}Date`}
          value={formData[`${prefix}Date`]}
          onChange={onChange}
          onBlur={onBlur}
          type="date"
          disabled={lockFields}
          error={getError(`${prefix}Date`)}
        />

        {showPaidField && (
          <AmountField
            label="Paid"
            value={
              lockPaid
                ? paidDisplay.toFixed(2)
                : formData[`${prefix}Paid`] ?? ""
            }
            onChange={handlePaidChange}
            onBlur={onBlur}
            readOnly={lockPaid}
            colors={colors}
            error={getError(`${prefix}Paid`) || paidCapError}
          />
        )}

        <AmountField
          label="Due"
          value={dueDisplayValue}
          readOnly
          colors={colors}
          error={getError(dueFieldName)}
        />

        <NewOrderField
          label="Memo"
          name={`${prefix}Memo`}
          value={formData[`${prefix}Memo`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Memo"
          disabled={lockFields}
        />
      </div>
    </div>
  );
}
