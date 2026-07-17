"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";
import { searchCompanyPortalFacilities } from "@/lib/company-portal/companyPortalFacilityApi";

export default function CompanyPortalFacilitySearchField({
  label = "Facility",
  value = "",
  disabled = false,
  onInputChange,
  onSelect,
  required = false,
  error = "",
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const skipBlurRef = useRef(false);

  const trimmedValue = `${value || ""}`.trim();
  const showSuggestions = open && !disabled && trimmedValue.length >= 2;

  useEffect(() => {
    if (!showSuggestions) {
      setSuggestions([]);
      setLoading(false);
      setSearchError("");
      return undefined;
    }

    let active = true;
    setLoading(true);
    setSearchError("");

    const timer = setTimeout(() => {
      searchCompanyPortalFacilities(trimmedValue)
        .then((facilities) => {
          if (!active) return;
          setSuggestions(facilities);
        })
        .catch((err) => {
          if (!active) return;
          setSuggestions([]);
          setSearchError(getApiErrorMessage(err, "Failed to search facilities"));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trimmedValue, showSuggestions]);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [suggestions, trimmedValue]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectFacility = (facility) => {
    skipBlurRef.current = true;
    onSelect?.(facility);
    setOpen(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (!showSuggestions || !suggestions.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter" && highlightIndex >= 0) {
      event.preventDefault();
      selectFacility(suggestions[highlightIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1.5 block text-[12px] font-medium text-[#334155]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>

      <input
        type="text"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={listboxId}
        value={value}
        disabled={disabled}
        placeholder="Type to search facilities..."
        onChange={(event) => onInputChange?.(event.target.value)}
        onFocus={() => !disabled && setOpen(true)}
        onBlur={() => {
          if (skipBlurRef.current) {
            skipBlurRef.current = false;
            return;
          }
          setOpen(false);
        }}
        onKeyDown={handleKeyDown}
        className={`h-10 w-full rounded-[8px] border bg-[#F8FAFC] px-3 text-[13px] text-[#0F172A] outline-none transition focus:bg-white focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
          error
            ? "border-red-500 focus:ring-red-500/10"
            : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
      />

      {error ? <p className="mt-1 text-[12px] text-red-500">{error}</p> : null}

      {showSuggestions ? (
        <ul
          id={listboxId}
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-[8px] border border-[#E2E8F0] bg-white py-1 shadow-lg"
        >
          {loading ? (
            <li className="px-3 py-2 text-[12px] text-[#64748B]">Searching...</li>
          ) : null}
          {!loading && searchError ? (
            <li className="px-3 py-2 text-[12px] text-red-500">{searchError}</li>
          ) : null}
          {!loading && !searchError && !suggestions.length ? (
            <li className="px-3 py-2 text-[12px] text-[#64748B]">
              No matching facilities found
            </li>
          ) : null}
          {!loading
            ? suggestions.map((facility, index) => {
                const name = facility.facilityName || "";
                const address = facility.address || "";
                const isActive = index === highlightIndex;

                return (
                  <li key={facility.id}>
                    <button
                      type="button"
                      onMouseDown={() => selectFacility(facility)}
                      className={`block w-full px-3 py-2 text-left ${
                        isActive ? "bg-[#E6F7FA]" : "hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <p className="text-[12px] font-semibold text-[#0F172A]">
                        {name}
                      </p>
                      {address ? (
                        <p className="text-[11px] text-[#64748B]">{address}</p>
                      ) : null}
                    </button>
                  </li>
                );
              })
            : null}
        </ul>
      ) : null}

      {!disabled && trimmedValue.length > 0 && trimmedValue.length < 2 ? (
        <p className="mt-1 text-[11px] text-[#64748B]">
          Type at least 2 characters to search
        </p>
      ) : null}
    </div>
  );
}
