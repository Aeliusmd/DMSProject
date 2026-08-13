const themes = {
  subpoena: {
    border: "border-[#E2E8F0]",
    header: "bg-[#F8FAFC]",
    bg: "bg-[#F8FAFC]",
    text: "text-[#475569]",
  },
  order: {
    border: "border-[#67D8E8]",
    header: "bg-[#E6F7FA]",
    bg: "bg-[#E6F7FA]",
    text: "text-[#007F96]",
  },
  serve: {
    border: "border-[#86EFAC]",
    header: "bg-[#ECFDF5]",
    bg: "bg-[#ECFDF5]",
    text: "text-[#059669]",
  },
  payment: {
    border: "border-[#DDD6FE]",
    header: "bg-[#F5F3FF]",
    bg: "bg-[#F5F3FF]",
    text: "text-[#7C3AED]",
  },
};

export default function CollapsibleOrderPanel({
  title,
  icon,
  color = "order",
  expanded,
  onToggle,
  children,
}) {
  const theme = themes[color];

  if (!expanded) {
    return (
      <section
        className={`flex h-[64px] shrink-0 overflow-hidden rounded-[12px] border sm:h-[72px] ${theme.border} ${theme.bg} xl:h-full xl:w-[64px]`}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex h-full w-full items-center justify-between gap-2 px-3 py-3 sm:px-4 xl:flex-col xl:px-0 xl:py-5"
        >
          <span className={`flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[8px] bg-white sm:h-[36px] sm:w-[36px] ${theme.text}`}>
            {icon}
          </span>

          <span
            className={`min-w-0 truncate text-[13px] font-semibold tracking-wide ${theme.text} xl:overflow-visible xl:whitespace-normal xl:[writing-mode:vertical-rl] xl:rotate-180`}
          >
            {title}
          </span>

          <span className={`flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[6px] bg-white ${theme.text}`}>
            <ChevronRightIcon />
          </span>
        </button>
      </section>
    );
  }

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[12px] border ${theme.border} bg-white shadow-sm`}
    >
      <div
        className={`flex h-[52px] shrink-0 items-center justify-between border-b border-[#E2E8F0] px-3 sm:h-[56px] sm:px-5 ${theme.header}`}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className={`flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[7px] bg-white sm:h-[30px] sm:w-[30px] ${theme.text}`}>
            {icon}
          </span>

          <h2 className={`truncate text-[13px] font-semibold sm:text-[14px] ${theme.text}`}>
            {title}
          </h2>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[6px] bg-white ${theme.text} hover:bg-[#F8FAFC]`}
        >
          <ChevronLeftIcon />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
        {children}
      </div>
    </section>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}