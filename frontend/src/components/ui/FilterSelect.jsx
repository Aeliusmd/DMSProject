"use client";

import { useEffect, useId, useRef, useState } from "react";

function ChevronIcon({ open }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`shrink-0 text-[#94A3B8] transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        d="M2.5 4.5L6 8L9.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Filter dropdown that always opens downward (never flips upward).
 * Replaces native <select>, which the browser may open upward when space is tight.
 */
export default function FilterSelect({
  value,
  onChange,
  options = [],
  disabled = false,
  "aria-label": ariaLabel,
  className = "",
  listClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const listboxId = useId();

  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? options[0]?.label ?? "";

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`flex w-full min-w-0 items-center justify-between gap-2 text-left ${className}`}
      >
        <span className="min-w-0 truncate">{displayLabel}</span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 top-full z-50 mt-1 max-h-56 w-full min-w-0 overflow-y-auto rounded-[6px] border border-[#E2E8F0] bg-white py-1 shadow-lg ${listClassName}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={`${option.value || "empty"}-${option.label}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange?.(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full px-3 py-2 text-left text-[12px] hover:bg-[#F1F5F9] ${
                    isSelected
                      ? "bg-[#E0F7FA] font-medium text-[#0097B2]"
                      : "text-[#64748B]"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
