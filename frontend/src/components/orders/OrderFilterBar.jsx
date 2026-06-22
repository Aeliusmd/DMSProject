"use client";

import { useEffect, useMemo, useState } from "react";
import { getFacilities } from "@/lib/facilities/facilityApi";

const defaultFilters = {
  facility: "",
  year: "",
  status: "",
  search: "",
};

export default function OrderFilterBar({ filters, onFiltersChange }) {
  const [localFilters, setLocalFilters] = useState(defaultFilters);
  const [facilities, setFacilities] = useState([]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();

    return Array.from({ length: 8 }, (_, index) => String(currentYear - index));
  }, []);

  useEffect(() => {
    let active = true;

    getFacilities()
      .then((data) => {
        if (active) setFacilities(data);
      })
      .catch(() => {
        if (active) setFacilities([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeFilters = filters || localFilters;

  const updateFilters = (nextFilters) => {
    if (!filters) {
      setLocalFilters(nextFilters);
    }

    onFiltersChange?.(nextFilters);
  };

  const updateFilter = (name, value) => {
    updateFilters({
      ...activeFilters,
      [name]: value,
    });
  };

  const handleReset = () => {
    updateFilters(defaultFilters);
  };

  return (
    <section className="rounded-[9px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
      <h2 className="mb-3 text-[13px] font-semibold text-[#111827]">
        Filters
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[160px_140px_140px_minmax(220px,1fr)_auto]">
        <select
          value={activeFilters.facility}
          onChange={(e) => updateFilter("facility", e.target.value)}
          className="h-[34px] rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#64748B] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
        >
          <option value="">All Facility</option>
          {facilities.map((facility) => (
            <option key={facility.id} value={String(facility.id)}>
              {facility.facility || facility.facilityName || facility.name}
            </option>
          ))}
        </select>

        <select
          value={activeFilters.year}
          onChange={(e) => updateFilter("year", e.target.value)}
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
          value={activeFilters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="h-[34px] rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#64748B] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="ready">Ready to Pickup</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="deleted">Deleted</option>
        </select>

        <div className="flex h-[34px] min-w-0 items-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[#94A3B8]">
          <SearchIcon />
          <input
            value={activeFilters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            placeholder="Search orders..."
            className="min-w-0 flex-1 bg-transparent text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8]"
          />
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="h-[34px] rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
        >
          Reset
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