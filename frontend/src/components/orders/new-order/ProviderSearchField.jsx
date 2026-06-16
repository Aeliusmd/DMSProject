"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchProviders } from "@/lib/providers/providerApi";

export default function ProviderSearchField({
  label = "Provider",
  value = "",
  providerId = "",
  onInputChange,
  onSelect,
  hint,
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
      searchProviders(query)
        .then((providers) => {
          if (!active) return;
          setSuggestions(providers);
        })
        .catch((err) => {
          if (!active) return;
          setSuggestions([]);
          setSearchError(err.message || "Failed to search providers");
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
        placeholder="Search or type company name"
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

      {providerId && (
        <p className="mt-[4px] text-[10px] font-medium text-[#059669]">
          Existing provider selected
        </p>
      )}

      {!providerId && value.trim() && (
        <p className="mt-[4px] text-[10px] text-[#94A3B8]">
          New provider will be added when you save the order
        </p>
      )}

      {hint && (
        <p className="mt-[4px] text-[10px] text-[#94A3B8]">{hint}</p>
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
            suggestions.map((provider) => (
              <li key={provider.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(provider);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-[#F0FBFD]"
                >
                  <span className="block text-[12px] font-semibold text-[#111827]">
                    {provider.companyName}
                  </span>
                  {(provider.city || provider.state) && (
                    <span className="block text-[10px] text-[#94A3B8]">
                      {[provider.city, provider.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                </button>
              </li>
            ))}

          {!loading && !searchError && suggestions.length === 0 && (
            <li className="px-3 py-2 text-[12px] text-[#94A3B8]">
              No matching providers — continue typing to add a new one
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
