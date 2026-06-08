"use client";

export default function ConfirmModal({
  open,
  title,
  message,
  variant = "warning",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  const isDanger = variant === "danger";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]">
      <section
        className="rounded-[9px] bg-white px-5 py-5 shadow-2xl"
        style={{
          width: "100%",
          maxWidth: "390px",
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="mt-[2px] flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: isDanger ? "#FEF2F2" : "#FFFBEB",
              color: isDanger ? "#EF4444" : "#F59E0B",
            }}
          >
            <WarningIcon />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-[#111827]">
              {title}
            </h2>

            <p className="mt-4 text-[12px] leading-[20px] text-[#475569]">
              {message}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="h-[34px] rounded-[6px] bg-[#F8FAFC] px-4 text-[12px] font-semibold text-[#334155] hover:bg-[#E2E8F0]"
              >
                {cancelLabel}
              </button>

              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] px-4 text-[12px] font-semibold text-white"
                style={{
                  backgroundColor: isDanger ? "#EF4444" : "#F59E0B",
                }}
              >
                {isDanger ? <TrashIcon /> : <SmallCircleIcon />}
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function WarningIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 9v4M12 17h.01M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SmallCircleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}