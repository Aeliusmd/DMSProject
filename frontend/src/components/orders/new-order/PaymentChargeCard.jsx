import NewOrderField from "@/components/orders/new-order/NewOrderField";

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

export default function PaymentChargeCard({
  title,
  amount,
  due,
  theme = "green",
  prefix,
  formData,
  onChange,
  onBlur,
  getError,
}) {
  const colors = paymentThemes[theme];

  return (
    <div className={`rounded-[10px] border ${colors.border} ${colors.bg} p-4`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className={`text-[14px] font-semibold ${colors.title}`}>
            {title}
          </h3>
          <p className={`mt-[2px] text-[11px] ${colors.title}`}>
            Amount: {amount}
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
          required
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
          required
          error={getError(`${prefix}Date`)}
        />

        <NewOrderField
          label="Paid"
          name={`${prefix}Paid`}
          value={formData[`${prefix}Paid`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="$ 0.00"
          required
          inputMode="decimal"
          error={getError(`${prefix}Paid`)}
        />

        <div>
          <p className="mb-[6px] text-[11px] font-semibold text-[#475569]">
            Due
          </p>
          <div
            className={`flex h-[38px] items-center rounded-[6px] bg-white/50 px-3 text-[14px] font-semibold ${colors.due}`}
          >
            {due}
          </div>
        </div>

        <NewOrderField
          label="Memo"
          name={`${prefix}Memo`}
          value={formData[`${prefix}Memo`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Memo"
        />
      </div>
    </div>
  );
}