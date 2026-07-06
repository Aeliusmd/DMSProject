"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { searchFacilities } from "@/lib/facilities/facilityApi";

export default function FacilitySearchField({
  label = "Facility",
  value = "",
  facilityId = "",
  onInputChange,
  onSelect,
  onBlur,
  facilityProfileIncomplete = false,
  facilityCreated = false,
  hint = "",
  required = false,
  error = "",
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    const query = value.trim();

    if (!open || query.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setSearchError("");
      return undefined;
    }

    let active = true;
    setLoading(true);
    setSearchError("");

    const timer = setTimeout(() => {
      searchFacilities(query)
        .then((facilities) => {
          if (!active) return;
          setSuggestions(facilities);
        })
        .catch((err) => {
          if (!active) return;
          setSuggestions([]);
          setSearchError(err.message || "Failed to search facilities");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value, open]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasError = Boolean(error);
  const showSuggestions = open && value.trim().length >= 2;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label className="mb-[6px] block text-[11px] font-semibold text-[#475569]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <input
        type="text"
        value={value}
        onChange={(e) => {
          onInputChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        placeholder="Search or type facility name"
        className={`h-[38px] w-full rounded-[6px] border bg-white px-3 text-[13px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
          hasError
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
            : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={listboxId}
        autoComplete="off"
      />

      {facilityId && !facilityProfileIncomplete && (
        <p className="mt-[4px] text-[10px] font-medium text-[#059669]">
          Existing facility selected
        </p>
      )}

      {facilityId && facilityProfileIncomplete && (
        <div className="mt-2 rounded-[6px] border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
          <p className="text-[11px] font-semibold text-[#B45309]">
            {facilityCreated
              ? "Facility was automatically created"
              : "Facility profile is incomplete"}
          </p>
          <p className="mt-1 text-[10px] leading-snug text-[#92400E]">
            Complete the facility details before continuing this order.
          </p>
          <Link
            href={`/facilities/${facilityId}/info`}
            className="mt-2 inline-flex text-[11px] font-semibold text-[#007F96] underline"
          >
            Open facility profile to complete
          </Link>
        </div>
      )}

      {!facilityId && value.trim() && (
        <p className="mt-[4px] text-[10px] text-[#94A3B8]">
          New facility will be added when you leave this field
        </p>
      )}

      {hint && (
        <p className="mt-[4px] text-[10px] font-medium text-[#059669]">{hint}</p>
      )}

      {error && (
        <p className="mt-[5px] text-[11px] font-medium text-red-500">
          {error}
        </p>
      )}

      {showSuggestions && (
        <ul
          id={listboxId}
          className="absolute z-20 mt-1 max-h-[220px] w-full overflow-auto rounded-[6px] border border-[#E2E8F0] bg-white py-1 shadow-lg"
        >
          {loading && (
            <li className="px-3 py-2 text-[12px] text-[#94A3B8]">
              Searching...
            </li>
          )}

          {!loading && searchError && (
            <li className="px-3 py-2 text-[12px] text-red-500">{searchError}</li>
          )}

          {!loading &&
            !searchError &&
            suggestions.map((facility) => (
              <li key={facility.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(facility);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-[#F0FBFD]"
                >
                  <span className="block text-[12px] font-semibold text-[#111827]">
                    {facility.facility || facility.facilityName}
                  </span>
                  {(facility.city || facility.state) && (
                    <span className="block text-[10px] text-[#94A3B8]">
                      {[facility.city, facility.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                </button>
              </li>
            ))}

          {!loading && !searchError && suggestions.length === 0 && (
            <li className="px-3 py-2 text-[12px] text-[#94A3B8]">
              No matching facilities — continue typing to add a new one
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
