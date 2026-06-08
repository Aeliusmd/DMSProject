"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import CurrentDateTime from "@/components/dashboard/CurrentDateTime";

const companyInvoices = [
  {
    id: 1,
    company: "Smith & Associates",
    email: "billing@smithassociates.com, accounts@smithassociates.com",
    cases: 4,
    needsResend: 1,
    invoiced: "$5,175.00",
    paid: "$1,800.00",
    due: "$3,375.00",
  },
  {
    id: 2,
    company: "Martinez Legal Group",
    email: "invoices@martinezlegal.com",
    cases: 3,
    needsResend: 1,
    invoiced: "$5,450.00",
    paid: "$2,500.00",
    due: "$2,950.00",
  },
  {
    id: 3,
    company: "Pacific Law Partners",
    email: "billing@pacificlaw.com, ar@pacificlaw.com",
    cases: 5,
    needsResend: 1,
    invoiced: "$6,990.00",
    paid: "$2,950.00",
    due: "$4,040.00",
  },
  {
    id: 4,
    company: "Williams & Co.",
    email: "finance@williamsco.com",
    cases: 2,
    needsResend: 1,
    invoiced: "$5,600.00",
    paid: "$1,500.00",
    due: "$4,100.00",
  },
  {
    id: 5,
    company: "Brown Family Trust",
    email: "trustee@brownfamilytrust.com",
    cases: 4,
    needsResend: 0,
    invoiced: "$4,600.00",
    paid: "$800.00",
    due: "$3,800.00",
  },
  {
    id: 6,
    company: "Davis Law Firm",
    email: "billing@davislawfirm.com",
    cases: 3,
    needsResend: 1,
    invoiced: "$6,050.00",
    paid: "$3,000.00",
    due: "$3,050.00",
  },
  {
    id: 7,
    company: "Rodriguez & Partners",
    email: "ar@rodriguezpartners.com",
    cases: 2,
    needsResend: 1,
    invoiced: "$3,550.00",
    paid: "$1,000.00",
    due: "$2,550.00",
  },
  {
    id: 8,
    company: "Thompson Industries",
    email: "ap@thompsonindustries.com, billing@thompsonindustries.com",
    cases: 4,
    needsResend: 0,
    invoiced: "$6,850.00",
    paid: "$2,500.00",
    due: "$4,350.00",
  },
  {
    id: 9,
    company: "Garcia Legal Services",
    email: "payments@garcialegal.com",
    cases: 3,
    needsResend: 1,
    invoiced: "$4,970.00",
    paid: "$1,800.00",
    due: "$3,170.00",
  },
  {
    id: 10,
    company: "Lee Tech Holdings",
    email: "finance@leetech.com",
    cases: 5,
    needsResend: 1,
    invoiced: "$9,400.00",
    paid: "$4,500.00",
    due: "$4,900.00",
  },
  {
    id: 11,
    company: "Anderson Accounting",
    email: "bills@andersonaccounting.com",
    cases: 3,
    needsResend: 0,
    invoiced: "$3,850.00",
    paid: "$1,200.00",
    due: "$2,650.00",
  },
  {
    id: 12,
    company: "Taylor Financial Group",
    email: "invoices@taylorfinancial.com, ar@taylorfinancial.com",
    cases: 3,
    needsResend: 1,
    invoiced: "$5,480.00",
    paid: "$2,000.00",
    due: "$3,480.00",
  },
  {
    id: 13,
    company: "Kim & Associates",
    email: "billing@kimassociates.com",
    cases: 2,
    needsResend: 0,
    invoiced: "$2,750.00",
    paid: "$900.00",
    due: "$1,850.00",
  },
  {
    id: 14,
    company: "Patel Law Office",
    email: "payments@patellaw.com",
    cases: 3,
    needsResend: 1,
    invoiced: "$4,150.00",
    paid: "$1,000.00",
    due: "$3,150.00",
  },
  {
    id: 15,
    company: "Johnson & Hayes",
    email: "ar@johnsonhayes.com, billing@johnsonhayes.com",
    cases: 4,
    needsResend: 0,
    invoiced: "$7,650.00",
    paid: "$3,500.00",
    due: "$4,150.00",
  },
  {
    id: 16,
    company: "Wilson Legal Corp",
    email: "finance@wilsonlegal.com",
    cases: 3,
    needsResend: 1,
    invoiced: "$4,700.00",
    paid: "$1,500.00",
    due: "$3,200.00",
  },
  {
    id: 17,
    company: "Chen & Associates",
    email: "billing@chenassociates.com",
    cases: 3,
    needsResend: 0,
    invoiced: "$5,550.00",
    paid: "$2,200.00",
    due: "$3,350.00",
  },
  {
    id: 18,
    company: "Miller Law Partners",
    email: "invoices@millerlaw.com",
    cases: 4,
    needsResend: 1,
    invoiced: "$4,450.00",
    paid: "$1,000.00",
    due: "$3,450.00",
  },
  {
    id: 19,
    company: "Harrison & Brooks",
    email: "ap@harrisonbrooks.com",
    cases: 3,
    needsResend: 0,
    invoiced: "$6,300.00",
    paid: "$2,500.00",
    due: "$3,800.00",
  },
  {
    id: 20,
    company: "Adams Legal Group",
    email: "billing@adamslegal.com",
    cases: 3,
    needsResend: 1,
    invoiced: "$4,950.00",
    paid: "$1,700.00",
    due: "$3,250.00",
  },
];

export default function CompanyWiseInvoicesPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return companyInvoices;

    return companyInvoices.filter((company) => {
      return (
        company.company.toLowerCase().includes(query) ||
        company.email.toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href="/invoices"
              className="mt-[2px] inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
            >
              <ArrowLeftIcon />
            </Link>

            <div className="min-w-0">
              <h1 className="text-[18px] font-semibold text-[#111827]">
                Company Wise Invoices
              </h1>

              <p className="mt-[4px] text-[12px] text-[#64748B]">
                View invoices grouped by company — click a company to manage its
                invoices
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[260px]">
              <SearchIcon />

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search companies..."
                className="h-[36px] w-full rounded-[6px] border border-[#CBD5E1] bg-white pl-9 pr-3 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
              />
            </div>

            <CurrentDateTime
              variant="short"
              prefix="as of"
              className="whitespace-nowrap text-[12px] text-[#94A3B8]"
            />
          </div>
        </div>

        <SummaryStrip />

        <CompanyWiseTable companies={filteredCompanies} />
      </div>
    </DashboardShell>
  );
}

function SummaryStrip() {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-4 shadow-sm">
      <div className="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryItem label="Companies" value="20" />
        <SummaryItem label="Total Cases" value="66" />
        <SummaryItem label="Needs Resend" value="13" orange />
        <SummaryItem label="Total Invoiced" value="$108,065.00" />
        <SummaryItem label="Total Paid" value="$39,450.00" green />
        <SummaryItem label="Total Due" value="$68,615.00" red />
      </div>
    </section>
  );
}

function SummaryItem({ label, value, green = false, red = false, orange = false }) {
  return (
    <div>
      <p className="mb-2 text-[11px] text-[#64748B]">{label}</p>

      <p
        className={`whitespace-nowrap text-[16px] font-semibold ${
          green
            ? "text-[#059669]"
            : red
            ? "text-red-500"
            : orange
            ? "text-[#EA580C]"
            : "text-[#111827]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CompanyWiseTable({ companies }) {
  return (
    <section className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
      <div className="h-full max-h-[calc(100vh-265px)] overflow-auto">
        <table className="w-full min-w-[1050px] border-collapse">
          <thead className="sticky top-0 z-10 bg-[#F8FAFC]">
            <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
              <th className="w-[250px] px-4 py-3">Company Name</th>
              <th className="w-[360px] px-4 py-3">Email</th>
              <th className="w-[110px] px-4 py-3 text-center">Total Cases</th>
              <th className="w-[120px] px-4 py-3 text-center">Needs Resend</th>
              <th className="w-[135px] px-4 py-3">Invoiced</th>
              <th className="w-[135px] px-4 py-3">Paid</th>
              <th className="w-[135px] px-4 py-3">Due</th>
              <th className="w-[100px] px-4 py-3 text-center"></th>
            </tr>
          </thead>

          <tbody>
            {companies.map((company) => (
              <tr
                key={company.id}
                className="border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#FCFEFF] hover:bg-[#F8FBFC]"
              >
                <td className="px-4 py-4 align-middle">
                  <Link
                    href={`/invoices/company-wise/${company.id}`}
                    className="text-left text-[12px] font-semibold text-[#007F96] hover:underline"
                  >
                    {company.company}
                  </Link>
                </td>

                <td className="px-4 py-4 align-middle">
                  <p className="max-w-[320px] truncate text-[12px] text-[#475569]">
                    {company.email}
                  </p>
                </td>

                <td className="px-4 py-4 text-center align-middle text-[12px] font-semibold text-[#334155]">
                  {company.cases}
                </td>

                <td className="px-4 py-4 text-center align-middle">
                  {company.needsResend > 0 ? (
                    <span className="inline-flex h-[20px] min-w-[22px] items-center justify-center rounded-full bg-[#FEF3C7] px-2 text-[11px] font-semibold text-[#D97706]">
                      {company.needsResend}
                    </span>
                  ) : (
                    <span className="text-[12px] text-[#94A3B8]">–</span>
                  )}
                </td>

                <td className="px-4 py-4 align-middle text-[12px] text-[#334155]">
                  {company.invoiced}
                </td>

                <td className="px-4 py-4 align-middle text-[12px] font-semibold text-[#059669]">
                  {company.paid}
                </td>

                <td className="px-4 py-4 align-middle text-[12px] font-semibold text-red-500">
                  {company.due}
                </td>

                <td className="px-4 py-4 text-center align-middle">
                  <Link
                    href={`/invoices/company-wise/${company.id}`}
                    className="inline-flex h-[26px] items-center justify-center gap-1 rounded-[6px] bg-[#E6F7FA] px-3 text-[11px] font-semibold text-[#007F96] hover:bg-[#DDF6FA]"
                  >
                    <span className="text-[12px]">+</span>
                    View
                  </Link>
                </td>
              </tr>
            ))}

            {companies.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-14 text-center text-[13px] text-[#94A3B8]"
                >
                  No companies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
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
    <svg
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="11"
        cy="11"
        r="7"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m20 20-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}