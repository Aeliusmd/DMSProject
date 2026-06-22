"use client";

function DeliveryCheckIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[#059669]"
    >
      <path
        d="M5 12l4 4L19 6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CompletedDeliveryLink({
  label,
  completed = false,
  hoverText = "",
  loading = false,
  onClick,
}) {
  if (completed) {
    return (
      <span
        title={hoverText || undefined}
        className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#059669]"
      >
        <DeliveryCheckIcon />
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={hoverText || undefined}
      className="inline-flex text-[10px] font-semibold text-[#007F96] underline hover:underline disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? `${label}...` : label}
    </button>
  );
}
