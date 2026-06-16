"use client";

export default function AlertModal({
  open,
  title,
  message,
  variant = "success",
  confirmLabel = "OK",
  onClose,
}) {
  if (!open) return null;

  const isSuccess = variant === "success";

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]">
      <section
        className="rounded-[9px] bg-white px-5 py-5 shadow-2xl"
        style={{ width: "100%", maxWidth: "390px" }}
      >
        <div className="flex items-start gap-4">
          <div
            className="mt-[2px] flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: isSuccess ? "#ECFDF5" : "#FEF2F2",
              color: isSuccess ? "#059669" : "#EF4444",
            }}
          >
            {isSuccess ? <CheckIcon /> : <ErrorIcon />}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-[#111827]">{title}</h2>

            <p className="mt-4 text-[12px] leading-[20px] text-[#475569]">
              {message}
            </p>

            <div className="mt-6 flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-[34px] items-center justify-center rounded-[6px] px-4 text-[12px] font-semibold text-white"
                style={{
                  backgroundColor: isSuccess ? "#0097B2" : "#EF4444",
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 9v4M12 17h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
