"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";
import { getFacilities } from "@/lib/facilities/facilityApi";

export const defaultPersonalOrderFilters = {
  facility: "",
  status: "",
  search: "",
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "in_process", label: "In Process" },
  { value: "invoice", label: "Invoice" },
  { value: "paid", label: "Paid" },
  { value: "released", label: "Released" },
];

export default function PersonalOrderFilterBar({ filters, onFiltersChange }) {
  const [draftFilters, setDraftFilters] = useState(defaultPersonalOrderFilters);
  const [searchDraft, setSearchDraft] = useState("");
  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoadError, setFacilitiesLoadError] = useState("");

  const appliedFilters = filters || defaultPersonalOrderFilters;

  useEffect(() => {
    setDraftFilters({
      facility: appliedFilters.facility || "",
      status: appliedFilters.status || "",
    });
    setSearchDraft(appliedFilters.search || "");
  }, [appliedFilters.facility, appliedFilters.status, appliedFilters.search]);

  useEffect(() => {
    let active = true;
    getFacilities()
      .then((data) => {
        if (!active) return;
        setFacilities(data);
        setFacilitiesLoadError("");
      })
      .catch((err) => {
        if (!active) return;
        setFacilities([]);
        setFacilitiesLoadError(
          getApiErrorMessage(err, "Failed to load facilities")
        );
      });
    return () => {
      active = false;
    };
  }, []);

  const facilityOptions = useMemo(
    () =>
      (facilities || []).map((facility) => ({
        value: String(facility.id),
        label:
          facility.facility ||
          facility.facilityName ||
          facility.name ||
          `Facility ${facility.id}`,
      })),
    [facilities]
  );

  return (
    <section className="rounded-[9px] border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[11px] font-semibold text-[#64748B]">
          Facility
          <select
            value={draftFilters.facility}
            onChange={(e) =>
              setDraftFilters((prev) => ({ ...prev, facility: e.target.value }))
            }
            className="h-[36px] rounded-[6px] border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#111827] outline-none focus:border-[#0097B2]"
          >
            <option value="">All facilities</option>
            {facilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[160px] flex-col gap-1 text-[11px] font-semibold text-[#64748B]">
          Status
          <select
            value={draftFilters.status}
            onChange={(e) =>
              setDraftFilters((prev) => ({ ...prev, status: e.target.value }))
            }
            className="h-[36px] rounded-[6px] border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#111827] outline-none focus:border-[#0097B2]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() =>
            onFiltersChange?.({
              ...draftFilters,
              search: appliedFilters.search || "",
            })
          }
          className="h-[36px] rounded-[6px] bg-[#0097B2] px-4 text-[13px] font-semibold text-white hover:bg-[#0086A0]"
        >
          Apply
        </button>

        <button
          type="button"
          onClick={() => {
            setDraftFilters(defaultPersonalOrderFilters);
            setSearchDraft("");
            onFiltersChange?.(defaultPersonalOrderFilters);
          }}
          className="h-[36px] rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[13px] font-semibold text-[#334155] hover:bg-[#F8FAFC]"
        >
          Reset
        </button>

        <div className="flex min-w-[240px] flex-[2] items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold text-[#64748B]">
            Search
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onFiltersChange?.({
                    ...appliedFilters,
                    search: searchDraft.trim(),
                  });
                }
              }}
              placeholder="Confirmation #, name, email…"
              className="h-[36px] rounded-[6px] border border-[#E2E8F0] px-3 text-[13px] outline-none focus:border-[#0097B2]"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              onFiltersChange?.({
                ...appliedFilters,
                search: searchDraft.trim(),
              })
            }
            className="h-[36px] rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[13px] font-semibold text-[#334155] hover:bg-[#F8FAFC]"
          >
            Search
          </button>
        </div>
      </div>

      {facilitiesLoadError ? (
        <p className="mt-2 text-[11px] text-red-500">{facilitiesLoadError}</p>
      ) : null}
    </section>
  );
}
