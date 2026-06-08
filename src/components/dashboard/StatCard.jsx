export default function StatCard({
  icon,
  value,
  label,
  change,
  iconBg = "#DDF6FA",
  iconColor = "#0097B2",
  layout = "vertical",
}) {
  if (layout === "horizontal") {
    return (
      <section className="min-w-0 rounded-[9px] border border-[#E2E8F0] bg-white px-[18px] py-[18px] shadow-sm">
        <div className="flex items-center gap-[16px]">
          <div
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[9px]"
            style={{
              backgroundColor: iconBg,
              color: iconColor,
            }}
          >
            {icon}
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-[24px] font-semibold leading-none text-[#111827]">
              {value}
            </h2>

            <p className="mt-[8px] truncate text-[12px] text-[#64748B]">
              {label}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0 rounded-[9px] border border-[#E2E8F0] bg-white px-[16px] py-[16px] shadow-sm">
      <div className="mb-[14px] flex items-start justify-between gap-3">
        <div
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
          style={{
            backgroundColor: iconBg,
            color: iconColor,
          }}
        >
          {icon}
        </div>

        {change && (
          <span className="shrink-0 text-[11px] font-medium text-[#059669]">
            {change}
          </span>
        )}
      </div>

      <h2 className="truncate text-[24px] font-semibold leading-none text-[#111827]">
        {value}
      </h2>

      <p className="mt-[8px] break-words text-[12px] text-[#64748B]">
        {label}
      </p>
    </section>
  );
}