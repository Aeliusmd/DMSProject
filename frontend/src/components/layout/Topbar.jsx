"use client";

import { useState } from "react";

const searchFilters = [
  { label: "Order ID", placeholder: "Search by Order ID..." },
  { label: "Case", placeholder: "Search by Case..." },
  { label: "Company", placeholder: "Search by Company..." },
];

export default function Topbar({ onToggleSidebar }) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(searchFilters[0]);

  const handleSelectFilter = (filter) => {
    setSelectedFilter(filter);
    setIsFilterOpen(false);

    // Later: update actual filtering logic here
    console.log("Selected filter:", filter.label);
  };

  return (
    <header className="sticky top-0 z-30 flex min-h-[52px] items-center gap-2 border-b border-[#E2E8F0] bg-white px-2 py-2 sm:gap-3 sm:px-[18px]">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[6px] text-[#0097B2] hover:bg-[#E6F7FA]"
      >
        <MenuIcon />
      </button>

      <div className="flex min-w-0 flex-1 items-center">
        <div className="flex h-[31px] w-full min-w-0 max-w-[455px] items-center overflow-visible rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="relative h-full shrink-0">
            <button
              type="button"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className="flex h-full min-w-[78px] items-center justify-between gap-[6px] border-r border-[#E2E8F0] px-[9px] text-[11px] text-[#334155] hover:bg-white sm:min-w-[100px] sm:px-[12px] sm:text-[13px]"
            >
              <span className="truncate">{selectedFilter.label}</span>
              <ChevronDownIcon />
            </button>

            {isFilterOpen && (
              <div className="absolute left-0 top-[36px] z-50 w-[130px] overflow-hidden rounded-[6px] border border-[#E2E8F0] bg-white shadow-sm">
                {searchFilters.map((filter) => (
                  <button
                    key={filter.label}
                    type="button"
                    onClick={() => handleSelectFilter(filter)}
                    className={`block w-full px-[12px] py-[9px] text-left text-[12px] transition hover:bg-[#F8FAFC] ${
                      selectedFilter.label === filter.label
                        ? "bg-[#E6F7FA] font-medium text-[#007F96]"
                        : "text-[#334155]"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-[6px] px-[8px] text-[#94A3B8] sm:gap-[8px] sm:px-[10px]">
            <SearchIcon />

            <input
              type="text"
              placeholder={selectedFilter.placeholder}
              className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] max-[390px]:placeholder:text-transparent sm:text-[13px]"
            />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-[18px]">
        <button
          type="button"
          className="relative flex h-[30px] w-[30px] items-center justify-center rounded-[6px] text-[#64748B] hover:bg-[#F8FAFC]"
        >
          <BellIcon />
          <span className="absolute right-[7px] top-[6px] h-[6px] w-[6px] rounded-full bg-[#EF4444]" />
        </button>

        <div className="flex shrink-0 items-center gap-[7px] sm:gap-[9px]">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#BDECF3] text-[11px] font-medium text-[#007F96]">
            JD
          </div>

          <p className="hidden text-[13px] font-medium text-[#111827] sm:block">
            John Doe
          </p>

          <span className="hidden sm:block">
            <ChevronDownIcon />
          </span>
        </div>
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="shrink-0"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      className="shrink-0"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}