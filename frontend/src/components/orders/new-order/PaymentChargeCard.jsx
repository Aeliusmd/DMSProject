import NewOrderField from "@/components/orders/new-order/NewOrderField";
import {
  dueAmountFromFee,
  formatMoneyAmount,
  formatPaidBracket,
  parsePaymentAmount,
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
  dueReadOnly,
  paidReadOnly,
  fieldsReadOnly = false,
}) {
  const colors = paymentThemes[theme];
  const lockDue = dueReadOnly ?? amountsReadOnly;
  const lockPaid = paidReadOnly ?? amountsReadOnly;
  const lockFields = fieldsReadOnly || lockPaid;
  const charge = parsePaymentAmount(chargeAmount);
  const paid = parsePaymentAmount(paidAmount);
  const paidBracket = formatPaidBracket(paid);
  const dueAmount = mirrorPaidDue
    ? charge
    : dueAmountFromFee(charge, paid);
  const paidDisplay = mirrorPaidDue ? charge : paid;
  const displayValue = (amount) => amount.toFixed(2);

  const handleDueChange = (event) => {
    if (lockDue) return;

    const rawDue = event.target.value
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1")
      .replace(/^(\d*\.\d{0,2}).*$/, "$1");
    const nextDue = parsePaymentAmount(rawDue);
    const nextPaid = Math.max(0, charge - nextDue);

    onChange({
      target: {
        name: `${prefix}Paid`,
        value: nextPaid > 0 ? nextPaid.toFixed(2) : "",
      },
    });
  };

  const handlePaidChange = (event) => {
    if (lockPaid) return;

    const rawPaid = event.target.value
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1")
      .replace(/^(\d*\.\d{0,2}).*$/, "$1");

    onChange({
      target: {
        name: `${prefix}Paid`,
        value: rawPaid,
      },
    });
  };

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
        <NewOrderField
          label="Check #"
          name={`${prefix}Check`}
          value={formData[`${prefix}Check`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Check number"
          required={!lockFields}
          disabled={lockFields}
          inputMode="numeric"
          maxLength={12}
          error={getError(`${prefix}Check`)}
        />

        <NewOrderField
          label="Check Date"
          name={`${prefix}Date`}
          value={formData[`${prefix}Date`]}
          onChange={onChange}
          onBlur={onBlur}
          type="date"
          required={!lockFields}
          disabled={lockFields}
          error={getError(`${prefix}Date`)}
        />

        {showPaidField && (
          <AmountField
            label="Paid"
            value={
              lockPaid
                ? displayValue(paidDisplay)
                : formData[`${prefix}Paid`] ?? ""
            }
            onChange={handlePaidChange}
            onBlur={onBlur}
            readOnly={lockPaid}
            colors={colors}
            error={getError(`${prefix}Paid`)}
          />
        )}

        <AmountField
          label="Due"
          value={displayValue(dueAmount)}
          onChange={handleDueChange}
          onBlur={onBlur}
          readOnly={lockDue}
          colors={colors}
          error={!showPaidField ? getError(`${prefix}Paid`) : ""}
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
