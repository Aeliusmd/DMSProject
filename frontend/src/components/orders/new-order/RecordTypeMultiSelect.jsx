"use client";

import { useEffect, useRef, useState } from "react";
import {
  ORDER_RECORD_TYPES,
  buildRecordTypeFormUpdates,
  getOrderTypeLabel,
  getSelectedRecordTypesFromForm,
} from "@/lib/orders/recordTypeUtils";

const SHORT_LABELS = {
  medical: "Medical",
  billing: "Billing",
  employment: "Employment",
  xrays: "X-Rays",
  other: "Other",
};

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

export default function RecordTypeMultiSelect({
  formData,
  onChange,
  onBlur,
  required = false,
  error = "",
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const selectedTypes = getSelectedRecordTypesFromForm(formData);
  const hasError = Boolean(error);
  const hasSelection = selectedTypes.length > 0;

  useEffect(() => {
    function handleClickOutside(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleType = (orderType) => {
    const next = new Set(selectedTypes);
    if (next.has(orderType)) {
      next.delete(orderType);
    } else {
      next.add(orderType);
    }

    const ordered = ORDER_RECORD_TYPES.map((record) => record.orderType).filter(
      (type) => next.has(type)
    );

    onChange({
      target: {
        name: "recordTypes",
        value: buildRecordTypeFormUpdates(ordered),
      },
    });
  };

  const handleBlur = () => {
    onBlur?.({ target: { name: "type" } });
  };

  return (
    <div ref={containerRef} className="relative min-w-0">
      <label className="mb-[6px] block text-[11px] font-semibold text-[#475569]">
        Record type
        {required && <span className="text-red-500"> *</span>}
      </label>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onBlur={handleBlur}
        className={`flex h-[38px] w-full items-center gap-2 rounded-[6px] border bg-white px-3 text-left outline-none focus:ring-2 ${
          hasError
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
            : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {!hasSelection ? (
            <span className="truncate text-[13px] text-[#94A3B8]">
              Select record types
            </span>
          ) : (
            selectedTypes.map((orderType) => (
              <span
                key={orderType}
                className="inline-flex max-w-[88px] shrink-0 items-center rounded-[4px] bg-[#E6F7FA] px-1.5 py-0.5 text-[10px] font-semibold text-[#007F96]"
                title={getOrderTypeLabel(orderType)}
              >
                <span className="truncate">
                  {SHORT_LABELS[orderType] || orderType}
                </span>
              </span>
            ))
          )}
        </span>

        {hasSelection && (
          <span className="shrink-0 rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-bold text-[#64748B]">
            {selectedTypes.length}
          </span>
        )}

        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[8px] border border-[#E2E8F0] bg-white shadow-lg">
          <div className="border-b border-[#F1F5F9] px-3 py-2">
            <p className="text-[10px] text-[#94A3B8]">
              Pick one or more types
            </p>
          </div>
          <div className="p-1.5">
            {ORDER_RECORD_TYPES.map((recordType) => {
              const checked = selectedTypes.includes(recordType.orderType);

              return (
                <label
                  key={recordType.key}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-[12px] transition hover:bg-[#F8FAFC] ${
                    checked ? "bg-[#F0FBFD] text-[#007F96]" : "text-[#334155]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleType(recordType.orderType)}
                    className="h-[13px] w-[13px] accent-[#0097B2]"
                  />
                  <span className="font-medium">{recordType.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {hasError && (
        <p className="mt-[5px] text-[11px] font-medium text-red-500">{error}</p>
      )}
    </div>
  );
}
