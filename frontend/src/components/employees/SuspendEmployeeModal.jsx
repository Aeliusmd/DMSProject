"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import useIsClient from "@/hooks/useIsClient";
import {
  getMinFutureDateTimeLocal,
  isFutureDateTimeLocal,
} from "@/lib/utils/dateUtils";

export default function SuspendEmployeeModal({
  open,
  employee,
  loading = false,
  onClose,
  onConfirm,
}) {
  const mounted = useIsClient();
  const [reactivatedAt, setReactivatedAt] = useState("");
  const [error, setError] = useState("");

  const minDateTime = useMemo(() => getMinFutureDateTimeLocal(), [open]);

  useEffect(() => {
    if (!open) return undefined;

    setReactivatedAt(minDateTime);
    setError("");

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open, minDateTime, employee?.id]);

  if (!mounted || !open || !employee) return null;

  const handleConfirm = () => {
    if (!reactivatedAt) {
      setError("Reactivation date and time is required");
      return;
    }

    if (!isFutureDateTimeLocal(reactivatedAt)) {
      setError("Reactivation date and time must be in the future");
      return;
    }

    onConfirm?.({
      reactivatedDate: `${reactivatedAt}:00`,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]">
      <section
        className="rounded-[9px] bg-white px-5 py-5 shadow-2xl"
        style={{ width: "100%", maxWidth: "420px" }}
      >
        <div className="flex items-start gap-4">
          <div
            className="mt-[2px] flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "#FFFBEB", color: "#F59E0B" }}
          >
            <WarningIcon />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-[#111827]">
              Suspend Employee
            </h2>

            <p className="mt-3 text-[12px] leading-[20px] text-[#475569]">
              Suspend {employee.name}? They will not be able to log in until the
              selected reactivation date and time.
            </p>

            <div className="mt-4">
              <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
                Reactivate automatically on
              </label>
              <input
                type="datetime-local"
                value={reactivatedAt}
                min={minDateTime}
                onChange={(event) => {
                  setReactivatedAt(event.target.value);
                  setError("");
                }}
                className="h-[36px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
              />
            </div>

            {error && (
              <p className="mt-3 text-[11px] font-medium text-red-600">{error}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="h-[34px] rounded-[6px] bg-[#F8FAFC] px-4 text-[12px] font-semibold text-[#334155] hover:bg-[#E2E8F0] disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleConfirm}
                className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] bg-[#F59E0B] px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <SmallCircleIcon />
                {loading ? "Processing..." : "Suspend"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
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
