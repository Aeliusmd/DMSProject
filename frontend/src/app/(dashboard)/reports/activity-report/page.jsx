"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";

const companiesSeed = [
  {
    id: 1,
    name: "Adventist Health",
    cases: 3,
    invoiced: 2845,
    paid: 2100,
    activities: ["Invoiced", "Paid"],
  },
  {
    id: 2,
    name: "Cedars-Sinai Medical Center",
    cases: 2,
    invoiced: 1950,
    paid: 1950,
    activities: ["Paid"],
  },
  {
    id: 3,
    name: "Children's Hospital LA",
    cases: 2,
    invoiced: 1120,
    paid: 560,
    activities: ["Invoiced", "Unpaid"],
  },
  {
    id: 4,
    name: "Community Health Systems",
    cases: 1,
    invoiced: 750,
    paid: 750,
    activities: ["Paid"],
  },
  {
    id: 5,
    name: "Dignity Health",
    cases: 2,
    invoiced: 1680,
    paid: 840,
    activities: ["Invoiced", "Unpaid"],
  },
  {
    id: 6,
    name: "Hoag Hospital",
    cases: 1,
    invoiced: 920,
    paid: 920,
    activities: ["Paid"],
  },
  {
    id: 7,
    name: "Kaiser Permanente",
    cases: 2,
    invoiced: 2100,
    paid: 1050,
    activities: ["Invoiced", "Unpaid"],
  },
  {
    id: 8,
    name: "MemorialCare Medical Group",
    cases: 1,
    invoiced: 1450,
    paid: 1450,
    activities: ["Paid"],
  },
  {
    id: 9,
    name: "Pacific Diagnostic Center",
    cases: 2,
    invoiced: 1300,
    paid: 650,
    activities: ["Invoiced", "Unpaid"],
  },
  {
    id: 10,
    name: "Palo Alto Medical Foundation",
    cases: 2,
    invoiced: 1100,
    paid: 550,
    activities: ["Invoiced", "Unpaid"],
  },
  {
    id: 11,
    name: "Scripps Health",
    cases: 2,
    invoiced: 1780,
    paid: 1780,
    activities: ["Paid"],
  },
  {
    id: 12,
    name: "St. Joseph Hospital",
    cases: 2,
    invoiced: 1350,
    paid: 675,
    activities: ["Invoiced", "Unpaid"],
  },
  {
    id: 13,
    name: "Torrance Memorial Medical Center",
    cases: 1,
    invoiced: 990,
    paid: 990,
    activities: ["Paid"],
  },
  {
    id: 14,
    name: "UCLA Health",
    cases: 2,
    invoiced: 2400,
    paid: 2400,
    activities: ["Paid"],
  },
  {
    id: 15,
    name: "Valley Medical Group",
    cases: 1,
    invoiced: 780,
    paid: 780,
    activities: ["Paid"],
  },
];

export default function ActivityReportPage() {
  const searchInputRef = useRef(null);

  const [filters, setFilters] = useState({
    reportDate: "2026-06-02",
    throughDate: "2026-06-02",
    customer: "All Customers",
    activity: "All",
  });

  const [expandedCompanyId, setExpandedCompanyId] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  const filteredCompanies = useMemo(() => {
    const search = appliedSearch.trim().toLowerCase();

    return companiesSeed.filter((company) => {
      const matchesCustomer =
        filters.customer === "All Customers" ||
        company.name === filters.customer;

      const matchesActivity =
        filters.activity === "All" ||
        company.activities.includes(filters.activity);

      const matchesSearch =
        !search ||
        company.name.toLowerCase().includes(search) ||
        String(company.cases).includes(search) ||
        String(company.invoiced).includes(search) ||
        String(company.paid).includes(search);

      return matchesCustomer && matchesActivity && matchesSearch;
    });
  }, [filters.customer, filters.activity, appliedSearch]);

  const totalCases = filteredCompanies.reduce(
    (sum, company) => sum + company.cases,
    0
  );

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePreset = (preset) => {
    if (preset === "Last Month") {
      setFilters((prev) => ({
        ...prev,
        reportDate: "2026-05-01",
        throughDate: "2026-05-31",
      }));
    }

    if (preset === "Last 6 Months") {
      setFilters((prev) => ({
        ...prev,
        reportDate: "2026-01-01",
        throughDate: "2026-06-30",
      }));
    }

    if (preset === "Last Year") {
      setFilters((prev) => ({
        ...prev,
        reportDate: "2025-01-01",
        throughDate: "2025-12-31",
      }));
    }
  };

  const handleSearch = () => {
    if (!isSearchOpen) {
      setIsSearchOpen(true);
      return;
    }

    setAppliedSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setAppliedSearch("");
    setIsSearchOpen(false);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      setAppliedSearch(searchInput);
    }

    if (e.key === "Escape") {
      handleClearSearch();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    console.log("Export activity report:", filteredCompanies);
  };

  const toggleCompany = (companyId) => {
    setExpandedCompanyId((current) =>
      current === companyId ? null : companyId
    );
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-[18px] font-semibold text-[#111827]">
            DMS Custodian - Activity Report
          </h1>

          <Link
            href="/reports"
            className="inline-flex h-[34px] w-fit items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
          >
            <ArrowLeftIcon />
            Back to Reports
          </Link>
        </div>

        <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReportField
              label="Report Date"
              name="reportDate"
              type="date"
              value={filters.reportDate}
              onChange={handleChange}
            />

            <ReportField
              label="Through Date"
              name="throughDate"
              type="date"
              value={filters.throughDate}
              onChange={handleChange}
            />

            <ReportField
              label="Customer"
              name="customer"
              type="select"
              value={filters.customer}
              onChange={handleChange}
              options={[
                "All Customers",
                ...companiesSeed.map((company) => company.name),
              ]}
            />

            <ReportField
              label="Activity"
              name="activity"
              type="select"
              value={filters.activity}
              onChange={handleChange}
              options={["All", "Invoiced", "Paid", "Unpaid", "Produced"]}
            />
          </div>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-[#94A3B8]">Quick presets:</span>

              {["Last Month", "Last 6 Months", "Last Year"].map(
                (preset, index) => (
                  <div key={preset} className="flex items-center gap-2">
                    {index > 0 && <span className="text-[#CBD5E1]">|</span>}

                    <button
                      type="button"
                      onClick={() => handlePreset(preset)}
                      className="font-semibold text-[#0097B2] hover:underline"
                    >
                      {preset}
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              {isSearchOpen && (
                <div className="relative w-full sm:w-[260px]">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex w-[34px] items-center justify-center text-[#94A3B8]">
                    <SearchIcon />
                  </div>

                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search companies..."
                    className="h-[34px] w-full rounded-[6px] border border-[#CBD5E1] bg-white pl-[36px] pr-8 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
                  />

                  {(searchInput || appliedSearch) && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-2 top-1/2 flex h-[20px] w-[20px] -translate-y-1/2 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155]"
                      aria-label="Clear search"
                    >
                      <CloseIcon />
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleSearch}
                className="inline-flex h-[34px] w-fit items-center justify-center gap-2 self-end rounded-[6px] bg-[#0097B2] px-5 text-[12px] font-semibold text-white hover:bg-[#0086A0] sm:self-auto"
              >
                <SearchIcon />
                Search
              </button>
            </div>
          </div>
        </section>

        <section className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
            <p className="text-[12px] font-semibold text-[#475569]">
              Showing {filteredCompanies.length} companies
            </p>

            <p className="text-[12px] text-[#94A3B8]">
              {totalCases} total cases
            </p>
          </div>

          <div className="max-h-[calc(100vh-345px)] overflow-auto">
            {filteredCompanies.map((company) => (
              <CompanyReportRow
                key={company.id}
                company={company}
                expanded={expandedCompanyId === company.id}
                onToggle={() => toggleCompany(company.id)}
              />
            ))}

            {filteredCompanies.length === 0 && (
              <div className="px-4 py-12 text-center text-[13px] text-[#94A3B8]">
                No activity report data found.
              </div>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-[#94A3B8]">
            Report generated on 06/02/2026
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] bg-[#111827] px-5 text-[12px] font-semibold text-white hover:bg-[#1F2937]"
            >
              <PrintIcon />
              Print
            </button>

            <button
              type="button"
              onClick={handleExport}
              className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-5 text-[12px] font-semibold text-[#475569] hover:bg-[#F8FAFC]"
            >
              <ExportIcon />
              Export
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function CompanyReportRow({ company, expanded, onToggle }) {
  return (
    <div className="border-b border-[#F1F5F9] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-1 gap-3 px-4 py-4 text-left transition hover:bg-[#F8FBFC] lg:grid-cols-[minmax(260px,1fr)_90px_130px_110px]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-[#64748B] transition ${
              expanded ? "rotate-90" : ""
            }`}
          >
            <ChevronRightIcon />
          </span>

          <span className="truncate text-[13px] font-semibold text-[#111827]">
            {company.name}
          </span>
        </div>

        <div className="flex items-center lg:justify-end">
          <span className="text-[12px] font-semibold text-[#0097B2]">
            {company.cases} {company.cases === 1 ? "Case" : "Cases"}
          </span>
        </div>

        <div className="flex items-center lg:justify-end">
          <span className="text-[12px] text-[#475569]">
            Invoiced:{" "}
            <span className="font-semibold text-[#111827]">
              {formatMoney(company.invoiced)}
            </span>
          </span>
        </div>

        <div className="flex items-center lg:justify-end">
          <span className="text-[12px] text-[#475569]">
            Paid:{" "}
            <span className="font-semibold text-[#059669]">
              {formatMoney(company.paid)}
            </span>
          </span>
        </div>
      </button>

      {expanded && (
        <div className="bg-[#F8FAFC] px-10 py-4">
          <div className="overflow-auto rounded-[8px] border border-[#E2E8F0] bg-white">
            <table className="w-full min-w-[620px] border-collapse">
              <thead className="bg-[#F8FAFC]">
                <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#64748B]">
                  <th className="px-4 py-3">Case</th>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>

              <tbody>
                {Array.from({ length: company.cases }, (_, index) => (
                  <tr
                    key={index}
                    className="border-b border-[#F1F5F9] last:border-b-0"
                  >
                    <td className="px-4 py-3 text-[12px] font-semibold text-[#007F96]">
                      {72010 + company.id}-{index + 1}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#475569]">
                      Sample Applicant {index + 1}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#475569]">
                      Invoice activity recorded
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] font-semibold text-[#111827]">
                      {formatMoney(Math.round(company.invoiced / company.cases))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportField({
  label,
  name,
  value,
  onChange,
  type = "text",
  options = [],
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold text-[#475569]">
        {label}
      </label>

      {type === "select" ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          className="h-[36px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          className="h-[36px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
        />
      )}
    </div>
  );
}

function formatMoney(value) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ArrowLeftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M19 12H5M11 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m20 20-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="m9 18 6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M7 14h10v7H7v-7Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3v12M8 11l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 21h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}