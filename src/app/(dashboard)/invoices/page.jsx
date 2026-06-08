"use client";

import { useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import InvoiceReportTable from "@/components/invoices/InvoiceReportTable";
import CurrentDateTime from "@/components/dashboard/CurrentDateTime";

const resendInvoices = [
  {
    id: 1,
    company: "Smith & Associates",
    email: "billing@smithassociates.com, accounts@smithassociates.com",
    caseNo: "71956-5",
    sentDate: "04/01/2026",
    days: 60,
    invoiceDate: "04/01/2026",
    invoiced: "$850.00",
    paid: "$0.00",
    due: "$850.00",
  },
  {
    id: 2,
    company: "Martinez Legal Group",
    email: "invoices@martinezlegal.com",
    caseNo: "72001-2",
    sentDate: "03/25/2026",
    days: 67,
    invoiceDate: "03/25/2026",
    invoiced: "$1,800.00",
    paid: "$500.00",
    due: "$1,300.00",
  },
  {
    id: 3,
    company: "Pacific Law Partners",
    email: "billing@pacificlaw.com, ar@pacificlaw.com",
    caseNo: "72012-2",
    sentDate: "02/28/2026",
    days: 92,
    invoiceDate: "02/28/2026",
    invoiced: "$1,500.00",
    paid: "$0.00",
    due: "$1,500.00",
  },
  {
    id: 4,
    company: "Williams & Co.",
    email: "finance@williamsco.com",
    caseNo: "72020-1",
    sentDate: "02/20/2026",
    days: 100,
    invoiceDate: "02/20/2026",
    invoiced: "$950.00",
    paid: "$0.00",
    due: "$950.00",
  },
  {
    id: 5,
    company: "Brown Family Trust",
    email: "billing@browntrust.com",
    caseNo: "72035-4",
    sentDate: "02/10/2026",
    days: 110,
    invoiceDate: "02/10/2026",
    invoiced: "$2,100.00",
    paid: "$0.00",
    due: "$2,100.00",
  },
  {
    id: 6,
    company: "Davis Law Firm",
    email: "accounts@davislawfirm.com",
    caseNo: "72058-2",
    sentDate: "01/30/2026",
    days: 121,
    invoiceDate: "01/30/2026",
    invoiced: "$1,250.00",
    paid: "$0.00",
    due: "$1,250.00",
  },
  {
    id: 7,
    company: "Rodriguez & Partners",
    email: "billing@rodriguezpartners.com",
    caseNo: "72067-1",
    sentDate: "01/22/2026",
    days: 129,
    invoiceDate: "01/22/2026",
    invoiced: "$1,600.00",
    paid: "$0.00",
    due: "$1,600.00",
  },
  {
    id: 8,
    company: "Thompson Industries",
    email: "ap@thompsonindustries.com",
    caseNo: "72070-2",
    sentDate: "01/15/2026",
    days: 136,
    invoiceDate: "01/15/2026",
    invoiced: "$2,500.00",
    paid: "$0.00",
    due: "$2,500.00",
  },
  {
    id: 9,
    company: "Garcia Legal Services",
    email: "billing@garcialegal.com",
    caseNo: "72088-3",
    sentDate: "01/05/2026",
    days: 146,
    invoiceDate: "01/05/2026",
    invoiced: "$975.00",
    paid: "$0.00",
    due: "$975.00",
  },
  {
    id: 10,
    company: "Lee Tech Holdings",
    email: "payables@leetech.com",
    caseNo: "72108-2",
    sentDate: "12/28/2025",
    days: 154,
    invoiceDate: "12/28/2025",
    invoiced: "$1,900.00",
    paid: "$0.00",
    due: "$1,900.00",
  },
  {
    id: 11,
    company: "Anderson Accounting",
    email: "invoices@andersonaccounting.com",
    caseNo: "72120-1",
    sentDate: "12/20/2025",
    days: 162,
    invoiceDate: "12/20/2025",
    invoiced: "$825.00",
    paid: "$0.00",
    due: "$825.00",
  },
  {
    id: 12,
    company: "Taylor Financial Group",
    email: "billing@taylorfinancial.com",
    caseNo: "72135-2",
    sentDate: "12/12/2025",
    days: 170,
    invoiceDate: "12/12/2025",
    invoiced: "$1,450.00",
    paid: "$0.00",
    due: "$1,450.00",
  },
  {
    id: 13,
    company: "Harrison Medical Group",
    email: "ar@harrisonmedical.com",
    caseNo: "72140-4",
    sentDate: "12/01/2025",
    days: 181,
    invoiceDate: "12/01/2025",
    invoiced: "$1,100.00",
    paid: "$0.00",
    due: "$1,100.00",
  },
];

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState("outstanding");
  const [filters, setFilters] = useState({
    from: "",
    through: "",
  });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFilterByDate = () => {
    console.log("Filter invoices:", filters);
  };

  const handleReset = () => {
    setFilters({
      from: "",
      through: "",
    });
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-[18px] font-semibold text-[#111827]">
            DMS Outstanding Invoices Report
          </h1>

          <CurrentDateTime
            variant="short"
            prefix="as of"
            className="text-[12px] text-[#94A3B8]"
          />
        </div>

        <div className="flex flex-col gap-3 border-b border-[#E2E8F0] pb-0 lg:flex-row lg:items-end lg:justify-between">
          <InvoiceTabs activeTab={activeTab} onChange={setActiveTab} />

          <Link
            href="/invoices/company-wise"
            className="mb-3 inline-flex h-[34px] w-fit items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-[#67D8E8] bg-[#E6F7FA] px-4 text-[12px] font-semibold text-[#007F96] hover:bg-[#DDF6FA]"
          >
            <CompanyIcon />
            View Company Wise
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(520px,650px)]">
          <InvoiceFilters
            filters={filters}
            onChange={handleFilterChange}
            onFilter={handleFilterByDate}
            onReset={handleReset}
          />

          <InvoiceSummary activeTab={activeTab} />
        </div>

        {activeTab === "outstanding" ? (
          <InvoiceReportTable />
        ) : (
          <ResendInvoicesPanel invoices={resendInvoices} />
        )}
      </div>
    </DashboardShell>
  );
}

function InvoiceTabs({ activeTab, onChange }) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto">
      <button
        type="button"
        onClick={() => onChange("outstanding")}
        className={`whitespace-nowrap border-b-2 px-5 py-3 text-[13px] font-semibold transition ${
          activeTab === "outstanding"
            ? "border-[#0097B2] bg-[#E6F7FA] text-[#007F96]"
            : "border-transparent text-[#64748B] hover:bg-[#F8FAFC]"
        }`}
      >
        Outstanding Invoices (66)
      </button>

      <button
        type="button"
        onClick={() => onChange("resend")}
        className={`whitespace-nowrap border-b-2 px-5 py-3 text-[13px] font-semibold transition ${
          activeTab === "resend"
            ? "border-[#0097B2] bg-[#E6F7FA] text-[#007F96]"
            : "border-transparent text-[#64748B] hover:bg-[#F8FAFC]"
        }`}
      >
        Resend Invoices (13)
      </button>
    </div>
  );
}

function InvoiceFilters({ filters, onChange, onFilter, onReset }) {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-5 shadow-sm">
      <h2 className="mb-4 text-[13px] font-semibold text-[#334155]">
        Filters
      </h2>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <DateField
          label="From"
          name="from"
          value={filters.from}
          onChange={onChange}
        />

        <DateField
          label="Through"
          name="through"
          value={filters.through}
          onChange={onChange}
        />

        <button
          type="button"
          onClick={onFilter}
          className="h-[38px] whitespace-nowrap rounded-[6px] bg-[#0097B2] px-5 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
        >
          Filter by Date
        </button>

        <button
          type="button"
          onClick={onReset}
          className="h-[38px] whitespace-nowrap rounded-[6px] bg-[#F1F5F9] px-5 text-[12px] font-semibold text-[#334155] hover:bg-[#E2E8F0]"
        >
          Reset
        </button>
      </div>
    </section>
  );
}

function DateField({ label, name, value, onChange }) {
  return (
    <div className="min-w-0 flex-1">
      <label className="mb-2 block text-[11px] font-medium text-[#64748B]">
        {label}
      </label>

      <input
        type="date"
        name={name}
        value={value}
        onChange={onChange}
        className="h-[38px] w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
      />
    </div>
  );
}

function InvoiceSummary({ activeTab }) {
  const summary =
    activeTab === "resend"
      ? {
          companies: "13",
          cases: "13",
          invoiced: "$18,800.00",
          paid: "$500.00",
          due: "$18,300.00",
        }
      : {
          companies: "20",
          cases: "66",
          invoiced: "$108,065.00",
          paid: "$39,450.00",
          due: "$68,615.00",
        };

  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-5 shadow-sm">
      <h2 className="mb-4 text-[13px] font-semibold text-[#334155]">
        Summary
      </h2>

      <div className="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3 xl:grid-cols-5">
        <SummaryItem label="Companies" value={summary.companies} />
        <SummaryItem label="Cases" value={summary.cases} />
        <SummaryItem label="Invoiced" value={summary.invoiced} />
        <SummaryItem label="Paid" value={summary.paid} green />
        <SummaryItem label="Due" value={summary.due} red />
      </div>
    </section>
  );
}

function SummaryItem({ label, value, green = false, red = false }) {
  return (
    <div className="min-w-[105px]">
      <p className="mb-2 text-[11px] text-[#64748B]">{label}</p>

      <p
        className={`whitespace-nowrap text-[18px] font-semibold ${
          green
            ? "text-[#059669]"
            : red
            ? "text-red-500"
            : "text-[#111827]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ResendInvoicesPanel({ invoices }) {
  return (
    <section className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
      <div className="h-full max-h-[calc(100vh-330px)] overflow-auto">
        <table className="w-full min-w-[1150px] border-collapse">
          <thead className="sticky top-0 z-10 bg-[#F8FAFC]">
            <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
              <th className="w-[48px] px-4 py-3">
                <input type="checkbox" className="h-[13px] w-[13px]" />
              </th>
              <th className="w-[230px] px-4 py-3">All Company</th>
              <th className="w-[310px] px-4 py-3">Email</th>
              <th className="w-[170px] px-4 py-3">Case</th>
              <th className="w-[130px] px-4 py-3">Inv Date</th>
              <th className="w-[130px] px-4 py-3">Invoiced</th>
              <th className="w-[130px] px-4 py-3">Paid</th>
              <th className="w-[130px] px-4 py-3">Due</th>
              <th className="w-[120px] px-4 py-3 text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {invoices.map((invoice) => (
              <tr
                key={invoice.id}
                className="border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#FCFEFF] hover:bg-[#F8FBFC]"
              >
                <td className="px-4 py-4 align-middle">
                  <input type="checkbox" className="h-[13px] w-[13px]" />
                </td>

                <td className="px-4 py-4 align-middle">
                  <p className="text-[12px] font-semibold text-[#111827]">
                    {invoice.company}
                  </p>
                </td>

                <td className="px-4 py-4 align-middle">
                  <p className="max-w-[270px] truncate text-[12px] text-[#475569]">
                    {invoice.email}
                  </p>
                </td>

                <td className="px-4 py-4 align-middle">
                  <div className="flex flex-wrap items-center gap-1 text-[12px]">
                    <button
                      type="button"
                      className="font-semibold text-[#007F96] hover:underline"
                    >
                      {invoice.caseNo}
                    </button>

                    <span className="text-[#94A3B8]">(invoice sent)</span>

                    <span className="font-semibold text-red-500">
                      {invoice.sentDate}
                    </span>

                    <span className="text-[#64748B]">
                      ({invoice.days} days)
                    </span>
                  </div>
                </td>

                <td className="px-4 py-4 align-middle text-[12px] text-[#475569]">
                  {invoice.invoiceDate}
                </td>

                <td className="px-4 py-4 align-middle text-[12px] text-[#475569]">
                  {invoice.invoiced}
                </td>

                <td className="px-4 py-4 align-middle text-[12px] font-semibold text-[#059669]">
                  {invoice.paid}
                </td>

                <td className="px-4 py-4 align-middle text-[12px] font-semibold text-[#111827]">
                  {invoice.due}
                </td>

                <td className="px-4 py-4 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => console.log("Resend invoice:", invoice)}
                    className="inline-flex h-[28px] items-center justify-center rounded-[6px] border border-[#67D8E8] bg-[#E6F7FA] px-3 text-[11px] font-semibold text-[#007F96] hover:bg-[#DDF6FA]"
                  >
                    Resend
                  </button>
                </td>
              </tr>
            ))}

            {invoices.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-14 text-center text-[13px] text-[#94A3B8]"
                >
                  No resend invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompanyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 21V5h16v16M8 9h2M8 13h2M8 17h2M14 9h2M14 13h2M14 17h2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}