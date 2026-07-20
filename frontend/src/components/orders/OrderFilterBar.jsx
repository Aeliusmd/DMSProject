"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";
import { getFacilities } from "@/lib/facilities/facilityApi";
import { getOrderFilterCompanies } from "@/lib/orders/orderApi";
import {
  ORDER_PERIOD_OPTIONS,
  ORDER_SOURCE_COMPANY,
  ORDER_SOURCE_INTERNAL,
  ORDER_SOURCE_OPTIONS,
  ORDER_SOURCE_PERSONAL,
  getStatusOptionsForOrderSource,
  isPersonalOrderSource,
} from "@/lib/orders/orderFilterConstants";

export const defaultOrderFilters = {
  facility: "",
  company: "",
  year: "",
  period: "",
  status: "",
  search: "",
  creationSource: ORDER_SOURCE_INTERNAL,
};

export default function OrderFilterBar({
  filters,
  onFiltersChange,
  showOrderSourceFilter = false,
  /** When source filter is hidden (e.g. Company Orders page), lock status options. */
  statusOptionsVariant = "internal",
}) {
  const [draftFilters, setDraftFilters] = useState(defaultOrderFilters);
  const [searchDraft, setSearchDraft] = useState("");
  const [facilities, setFacilities] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [facilitiesLoadError, setFacilitiesLoadError] = useState("");
  const [companiesLoadError, setCompaniesLoadError] = useState("");

  const appliedFilters = filters || defaultOrderFilters;
  const draftOrderSource = showOrderSourceFilter
    ? draftFilters.creationSource || ORDER_SOURCE_INTERNAL
    : statusOptionsVariant === "company"
      ? ORDER_SOURCE_COMPANY
      : statusOptionsVariant === "personal"
        ? ORDER_SOURCE_PERSONAL
        : ORDER_SOURCE_INTERNAL;
  const isPersonalDraft = isPersonalOrderSource(draftOrderSource);
  const statusOptions = getStatusOptionsForOrderSource(draftOrderSource);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();

    return Array.from({ length: 8 }, (_, index) => String(currentYear - index));
  }, []);

  useEffect(() => {
    setDraftFilters({
      facility: appliedFilters.facility || "",
      company: appliedFilters.company || "",
      year: appliedFilters.year || "",
      period: appliedFilters.period || "",
      status: appliedFilters.status || "",
      creationSource:
        appliedFilters.creationSource || ORDER_SOURCE_INTERNAL,
    });
    setSearchDraft(appliedFilters.search || "");
  }, [
    appliedFilters.facility,
    appliedFilters.company,
    appliedFilters.year,
    appliedFilters.period,
    appliedFilters.status,
    appliedFilters.search,
    appliedFilters.creationSource,
  ]);

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

    getOrderFilterCompanies()
      .then((data) => {
        if (!active) return;
        setCompanies(data);
        setCompaniesLoadError("");
      })
      .catch((err) => {
        if (!active) return;
        setCompanies([]);
        setCompaniesLoadError(
          getApiErrorMessage(err, "Failed to load companies")
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const updateDraftFilter = (name, value) => {
    setDraftFilters((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      // Switching source clears status so incompatible values are not applied.
      if (name === "creationSource") {
        next.status = "";
        if (value === ORDER_SOURCE_PERSONAL) {
          next.company = "";
        }
      }

      return next;
    });
  };

  const handleApplyFilters = () => {
    onFiltersChange?.({
      ...draftFilters,
      company: isPersonalOrderSource(draftFilters.creationSource)
        ? ""
        : draftFilters.company,
      search: appliedFilters.search || "",
    });
  };

  const handleSearch = () => {
    onFiltersChange?.({
      ...appliedFilters,
      search: searchDraft.trim(),
    });
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  };

  const handleReset = () => {
    setDraftFilters(defaultOrderFilters);
    setSearchDraft("");
    onFiltersChange?.(defaultOrderFilters);
  };

  const filterGridClass = showOrderSourceFilter
    ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[170px_160px_180px_140px_170px_140px_auto_auto]"
    : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[160px_180px_140px_170px_140px_auto_auto]";

  return (
    <section className="rounded-[9px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
      <h2 className="mb-3 text-[13px] font-semibold text-[#111827]">
        Filters
      </h2>

      <div className={filterGridClass}>
        {showOrderSourceFilter ? (
          <select
            value={draftOrderSource}
            onChange={(e) => updateDraftFilter("creationSource", e.target.value)}
            className="h-[34px] rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#64748B] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
            aria-label="Order source"
          >
            {ORDER_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}

        <div>
          <select
            value={draftFilters.facility}
            onChange={(e) => updateDraftFilter("facility", e.target.value)}
            disabled={Boolean(facilitiesLoadError)}
            className="h-[34px] w-full rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#64748B] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">
              {facilitiesLoadError ? "Facilities unavailable" : "All Facility"}
            </option>
            {facilities.map((facility) => (
              <option key={facility.id} value={String(facility.id)}>
                {facility.facility || facility.facilityName || facility.name}
              </option>
            ))}
          </select>
          {facilitiesLoadError && (
            <p className="mt-1 text-[10px] font-medium text-red-600">
              {facilitiesLoadError}
            </p>
          )}
        </div>

        {!isPersonalDraft ? (
          <div>
            <select
              value={draftFilters.company}
              onChange={(e) => updateDraftFilter("company", e.target.value)}
              disabled={Boolean(companiesLoadError)}
              className="h-[34px] w-full rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#64748B] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {companiesLoadError ? "Companies unavailable" : "All Company"}
              </option>
              {companies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
            {companiesLoadError && (
              <p className="mt-1 text-[10px] font-medium text-red-600">
                {companiesLoadError}
              </p>
            )}
          </div>
        ) : null}

        <select
          value={draftFilters.year}
          onChange={(e) => updateDraftFilter("year", e.target.value)}
          className="h-[34px] rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#64748B] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
        >
          <option value="">All Year</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select
          value={draftFilters.period || ""}
          onChange={(e) => updateDraftFilter("period", e.target.value)}
          className="h-[34px] rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#64748B] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
        >
          {ORDER_PERIOD_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={draftFilters.status}
          onChange={(e) => updateDraftFilter("status", e.target.value)}
          className="h-[34px] rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#64748B] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
        >
          {statusOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleApplyFilters}
          className="h-[34px] whitespace-nowrap rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
        >
          Apply Filters
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="h-[34px] whitespace-nowrap rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
        >
          Reset
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[#94A3B8]">
          <SearchIcon />
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search order ID, facility, company, case, applicant..."
            className="min-w-0 flex-1 bg-transparent text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8]"
          />
        </div>

        <button
          type="button"
          onClick={handleSearch}
          className="h-[34px] whitespace-nowrap rounded-[6px] bg-[#0097B2] px-5 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
        >
          Search
        </button>
      </div>
    </section>
  );
}

function SearchIcon() {
  return (
    <svg
      className="shrink-0"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
