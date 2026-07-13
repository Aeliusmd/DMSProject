"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";
import { searchPersonalRequestFacilities } from "@/lib/personal-request/personalRequestApi";

export default function PersonalFacilitySearchField({
  value = "",
  facilityId = "",
  onInputChange,
  onSelect,
  onBlur,
  error = "",
  required = false,
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const trimmedValue = value.trim();
  const showSuggestions = open && trimmedValue.length >= 2;

  useEffect(() => {
    const query = trimmedValue;

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
      searchPersonalRequestFacilities(query)
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
  }, [trimmedValue, open]);

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
    onSelect?.(facility);
    setOpen(false);
    setHighlightIndex(-1);
  };

  const trySelectExactMatch = async () => {
    const query = trimmedValue;
    if (query.length < 2) return false;

    let list = suggestions;
    if (!list.length) {
      try {
        list = await searchPersonalRequestFacilities(query);
      } catch {
        return false;
      }
    }

    const exact = list.find(
      (facility) =>
        `${facility.facilityName || ""}`.trim().toLowerCase() === query.toLowerCase()
    );
    if (exact) {
      selectFacility(exact);
      return true;
    }
    return false;
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      if (!showSuggestions || loading || suggestions.length === 0) return;
      e.preventDefault();
      setHighlightIndex((index) => Math.min(index + 1, suggestions.length - 1));
      return;
    }

    if (e.key === "ArrowUp") {
      if (!showSuggestions || loading || suggestions.length === 0) return;
      e.preventDefault();
      setHighlightIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (e.key === "Escape") {
      setOpen(false);
      setHighlightIndex(-1);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (
        showSuggestions &&
        !loading &&
        highlightIndex >= 0 &&
        suggestions[highlightIndex]
      ) {
        selectFacility(suggestions[highlightIndex]);
        return;
      }
      trySelectExactMatch().then((matched) => {
        if (!matched) {
          setOpen(false);
          onBlur?.();
        }
      });
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label className="mb-1.5 block text-[12px] font-semibold text-[#334155]">
        Treating Facility Name
        {required ? <span className="text-red-500"> *</span> : null}
      </label>

      <input
        type="text"
        value={value}
        onChange={(e) => {
          onInputChange?.(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (rootRef.current?.contains(e.relatedTarget)) return;
          trySelectExactMatch().then((matched) => {
            if (!matched) onBlur?.();
          });
        }}
        onKeyDown={handleKeyDown}
        placeholder="e.g. Los Angeles Medical Center"
        autoComplete="off"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={listboxId}
        className={`h-[42px] w-full rounded-[8px] border bg-white px-3 text-[13px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
            : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
      />

      {facilityId ? (
        <p className="mt-1 text-[11px] font-medium text-[#059669]">
          Existing facility selected — address filled automatically
        </p>
      ) : trimmedValue.length >= 2 ? (
        <p className="mt-1 text-[11px] text-[#94A3B8]">
          Select a match from the list, or continue typing a new facility name
        </p>
      ) : null}

      {error ? (
        <p className="mt-1 text-[11px] font-medium text-red-500">{error}</p>
      ) : null}

      {showSuggestions ? (
        <ul
          id={listboxId}
          className="absolute z-20 mt-1 max-h-[240px] w-full overflow-auto rounded-[8px] border border-[#E2E8F0] bg-white py-1 shadow-lg"
        >
          {loading ? (
            <li className="px-3 py-2 text-[12px] text-[#94A3B8]">Searching...</li>
          ) : null}

          {!loading && searchError ? (
            <li className="px-3 py-2 text-[12px] text-red-500">{searchError}</li>
          ) : null}

          {!loading &&
            !searchError &&
            suggestions.map((facility, index) => (
              <li key={facility.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectFacility(facility)}
                  className={`block w-full px-3 py-2 text-left ${
                    highlightIndex === index ? "bg-[#F0FBFD]" : "hover:bg-[#F0FBFD]"
                  }`}
                >
                  <span className="block text-[12px] font-semibold text-[#111827]">
                    {facility.facilityName}
                  </span>
                  {facility.address ? (
                    <span className="block text-[10px] text-[#94A3B8]">
                      {facility.address}
                    </span>
                  ) : (
                    <span className="block text-[10px] text-[#94A3B8]">
                      No address on file
                    </span>
                  )}
                </button>
              </li>
            ))}

          {!loading && !searchError && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-[12px] text-[#94A3B8]">
              No matching facilities — you can enter a new facility name
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
