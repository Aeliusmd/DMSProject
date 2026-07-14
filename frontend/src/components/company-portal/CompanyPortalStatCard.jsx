export default function CompanyPortalStatCard({
  label,
  value,
  hint,
  icon,
  iconBg = "#E6F7FA",
  iconColor = "#0097B2",
}) {
  return (
    <section className="min-w-0 rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[9px]"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      </div>

      <h2 className="truncate text-[26px] font-semibold leading-none text-[#111827]">
        {value}
      </h2>

      <p className="mt-2 text-[12px] font-medium text-[#334155]">{label}</p>

      {hint ? (
        <p className="mt-1 text-[11px] text-[#94A3B8]">{hint}</p>
      ) : null}
    </section>
  );
}
