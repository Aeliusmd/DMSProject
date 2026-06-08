"use client";

import { useState } from "react";

export default function OrderFilterBar() {
  const [customer, setCustomer] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const handleReset = () => {
    setCustomer("");
    setYear("");
    setStatus("");
    setSearch("");
  };

  return (
    <section className="rounded-[9px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
      <h2 className="mb-3 text-[13px] font-semibold text-[#111827]">
        Filters
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[160px_140px_140px_minmax(220px,1fr)_auto]">
        <select
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          className="h-[34px] rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#64748B] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
        >
          <option value="">Customer</option>
          <option value="smith">Smith & Associates</option>
          <option value="martinez">Martinez Legal Group</option>
          <option value="pacific">Pacific Law Partners</option>
        </select>

        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="h-[34px] rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#64748B] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
        >
          <option value="">Year</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-[34px] rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] text-[#64748B] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
        >
          <option value="">Status</option>
          <option value="active">Active</option>
          <option value="ready">Ready</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <div className="flex h-[34px] min-w-0 items-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[#94A3B8]">
          <SearchIcon />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
    <svg className="shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}