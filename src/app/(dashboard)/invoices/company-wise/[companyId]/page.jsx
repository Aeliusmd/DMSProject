"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";

const companyDetails = {
  1: {
    name: "Smith & Associates",
    email: "billing@smithassociates.com, accounts@smithassociates.com",
  },
  2: {
    name: "Martinez Legal Group",
    email: "invoices@martinezlegal.com",
  },
  3: {
    name: "Pacific Law Partners",
    email: "billing@pacificlaw.com, ar@pacificlaw.com",
  },
};

const invoiceSeed = [
  {
    id: 1,
    invoiceId: "71956-4",
    invoiceDate: "03/18/2026",
    days: 74,
    status: "Partial",
    invoiced: "$1,250.00",
    paid: "$400.00",
    due: "$850.00",
  },
  {
    id: 2,
    invoiceId: "71956-5",
    invoiceDate: "04/01/2026",
    days: 60,
    status: "Needs Resend",
    invoiced: "$850.00",
    paid: "$0.00",
    due: "$850.00",
  },
  {
    id: 3,
    invoiceId: "71956-6",
    invoiceDate: "04/15/2026",
    days: 46,
    status: "Partial",
    invoiced: "$2,100.00",
    paid: "$1,200.00",
    due: "$900.00",
  },
  {
    id: 4,
    invoiceId: "71956-7",
    invoiceDate: "05/02/2026",
    days: 29,
    status: "Unpaid",
    invoiced: "$975.00",
    paid: "$0.00",
    due: "$975.00",
  },
];

export default function CompanyInvoiceDetailsPage() {
  const params = useParams();
  const companyId = String(params.companyId);

  const company = companyDetails[companyId] || {
    name: "Smith & Associates",
    email: "billing@smithassociates.com, accounts@smithassociates.com",
  };

  const [invoices] = useState(invoiceSeed);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    fromDate: "",
    toDate: "",
  });

  const filteredInvoices = useMemo(() => {
    const searchValue = filters.search.trim().toLowerCase();
    const fromDate = filters.fromDate ? new Date(filters.fromDate) : null;
    const toDate = filters.toDate ? new Date(filters.toDate) : null;

    return invoices.filter((invoice) => {
      const matchesInvoiceId = invoice.invoiceId
        .toLowerCase()
        .includes(searchValue);

      const invoiceDate = parseInvoiceDate(invoice.invoiceDate);

      const matchesFromDate = fromDate ? invoiceDate >= fromDate : true;
      const matchesToDate = toDate ? invoiceDate <= toDate : true;

      return matchesInvoiceId && matchesFromDate && matchesToDate;
    });
  }, [invoices, filters]);

  const selectedInvoices = useMemo(() => {
    return invoices.filter((invoice) => selectedIds.includes(invoice.id));
  }, [invoices, selectedIds]);

  const filteredInvoiceIds = filteredInvoices.map((invoice) => invoice.id);

  const allSelected =
    filteredInvoices.length > 0 &&
    filteredInvoiceIds.every((id) => selectedIds.includes(id));

  const selectedCount = selectedIds.length;
  const hasSelectedInvoices = selectedCount > 0;

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      fromDate: "",
      toDate: "",
    });
  };

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !filteredInvoiceIds.includes(id))
      );
      return;
    }

    setSelectedIds((prev) => {
      const nextIds = new Set(prev);

      filteredInvoiceIds.forEach((id) => {
        nextIds.add(id);
      });

      return Array.from(nextIds);
    });
  };

  const handleToggleInvoice = (invoiceId) => {
    setSelectedIds((prev) =>
      prev.includes(invoiceId)
        ? prev.filter((id) => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const handleResendSelected = () => {
    if (selectedInvoices.length === 0) return;

    console.log("Resend selected invoices:", selectedInvoices);
  };

  const handleWriteOffSelected = () => {
    if (selectedInvoices.length === 0) return;

    console.log("Write off selected invoices:", selectedInvoices);
  };

  const handleWriteOffSingle = (invoice) => {
    console.log("Write off invoice:", invoice);
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href="/invoices/company-wise"
              className="mt-[2px] inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
            >
              <ArrowLeftIcon />
            </Link>

            <div className="min-w-0">
              <h1 className="text-[18px] font-semibold text-[#111827]">
                {company.name}
              </h1>

              <p className="mt-[4px] truncate text-[12px] text-[#64748B]">
                {company.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <button
              type="button"
              onClick={handleResendSelected}
              disabled={!hasSelectedInvoices}
              className={`inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] border px-4 text-[12px] font-semibold transition disabled:cursor-not-allowed ${
                hasSelectedInvoices
                  ? "border-[#0097B2] bg-[#0097B2] text-white shadow-sm hover:bg-[#0086A0]"
                  : "border-[#E2E8F0] bg-white text-[#94A3B8] opacity-70"
              }`}
            >
              <SendIcon />
              Resend Selected ({selectedCount})
            </button>

            <button
              type="button"
              onClick={handleWriteOffSelected}
              disabled={!hasSelectedInvoices}
              className={`inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] border px-4 text-[12px] font-semibold transition disabled:cursor-not-allowed ${
                hasSelectedInvoices
                  ? "border-red-500 bg-red-500 text-white shadow-sm hover:bg-red-600"
                  : "border-[#E2E8F0] bg-white text-[#94A3B8] opacity-70"
              }`}
            >
              <CircleIcon />
              Write Off Selected ({selectedCount})
            </button>
          </div>
        </div>

        <SummaryCards selectedCount={selectedCount} />

        <InvoiceFilters
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          resultCount={filteredInvoices.length}
        />

        <CompanyInvoiceTable
          invoices={filteredInvoices}
          selectedIds={selectedIds}
          allSelected={allSelected}
          onToggleAll={handleToggleAll}
          onToggleInvoice={handleToggleInvoice}
          onWriteOffSingle={handleWriteOffSingle}
        />
      </div>
    </DashboardShell>
  );
}

function InvoiceFilters({ filters, onChange, onReset, resultCount }) {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]">
          <div>
            <label className="mb-2 block text-[11px] font-semibold text-[#64748B]">
              Search Invoice ID
            </label>

            <div className="relative">
              <SearchIcon />

              <input
                type="text"
                name="search"
                value={filters.search}
                onChange={onChange}
                placeholder="Search by invoice ID..."
                className="h-[38px] w-full rounded-[6px] border border-[#CBD5E1] bg-white pl-9 pr-3 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
              />
            </div>
          </div>

          <DateField
            label="From Date"
            name="fromDate"
            value={filters.fromDate}
            onChange={onChange}
          />

          <DateField
            label="To Date"
            name="toDate"
            value={filters.toDate}
            onChange={onChange}
          />

          <button
            type="button"
            onClick={onReset}
            className="h-[38px] self-end whitespace-nowrap rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 text-[12px] font-semibold text-[#475569] hover:bg-[#F1F5F9]"
          >
            Reset
          </button>
        </div>

        <p className="whitespace-nowrap text-[12px] text-[#94A3B8]">
          Showing {resultCount} invoice{resultCount === 1 ? "" : "s"}
        </p>
      </div>
    </section>
  );
}

function DateField({ label, name, value, onChange }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold text-[#64748B]">
        {label}
      </label>

      <input
        type="date"
        name={name}
        value={value}
        onChange={onChange}
        className="h-[38px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
      />
    </div>
  );
}

function SummaryCards({ selectedCount }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <SummaryCard label="Total Cases" value="4" />
      <SummaryCard label="Needs Resend" value="1" orange />
      <SummaryCard label="Total Invoiced" value="$5,175.00" />
      <SummaryCard label="Total Paid" value="$1,600.00" green />
      <SummaryCard label="Total Due" value="$3,575.00" red />
      <SummaryCard label="Selected" value={selectedCount} muted />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  green = false,
  red = false,
  orange = false,
  muted = false,
}) {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-4 shadow-sm">
      <p className="mb-2 text-[11px] text-[#64748B]">{label}</p>

      <p
        className={`text-[20px] font-semibold ${
          green
            ? "text-[#059669]"
            : red
            ? "text-red-500"
            : orange
            ? "text-[#EA580C]"
            : muted
            ? "text-[#94A3B8]"
            : "text-[#111827]"
        }`}
      >
        {value}
      </p>
    </section>
  );
}

function CompanyInvoiceTable({
  invoices,
  selectedIds,
  allSelected,
  onToggleAll,
  onToggleInvoice,
  onWriteOffSingle,
}) {
  return (
    <section className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
      <div className="h-full max-h-[calc(100vh-370px)] overflow-auto">
        <table className="w-full min-w-[950px] border-collapse">
          <thead className="sticky top-0 z-10 bg-[#F8FAFC]">
            <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
              <th className="w-[48px] px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="h-[13px] w-[13px]"
                />
              </th>
              <th className="w-[160px] px-4 py-3">Invoice ID</th>
              <th className="w-[180px] px-4 py-3">Invoice Date</th>
              <th className="w-[140px] px-4 py-3 text-center">Status</th>
              <th className="w-[140px] px-4 py-3">Invoiced</th>
              <th className="w-[140px] px-4 py-3">Paid</th>
              <th className="w-[140px] px-4 py-3">Due</th>
              <th className="w-[120px] px-4 py-3 text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {invoices.map((invoice) => {
              const selected = selectedIds.includes(invoice.id);

              return (
                <tr
                  key={invoice.id}
                  className="border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#FCFEFF] hover:bg-[#F8FBFC]"
                >
                  <td className="px-4 py-4 align-middle">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleInvoice(invoice.id)}
                      className="h-[13px] w-[13px]"
                    />
                  </td>

                  <td className="px-4 py-4 align-middle">
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-[#007F96] hover:underline"
                    >
                      {invoice.invoiceId}
                    </button>
                  </td>

                  <td className="px-4 py-4 align-middle">
                    <p className="text-[12px] font-semibold text-red-500">
                      {invoice.invoiceDate}
                    </p>

                    <p className="mt-1 text-[10px] text-[#64748B]">
                      ({invoice.days} days)
                    </p>
                  </td>

                  <td className="px-4 py-4 text-center align-middle">
                    <StatusBadge status={invoice.status} />
                  </td>

                  <td className="px-4 py-4 align-middle text-[12px] text-[#475569]">
                    {invoice.invoiced}
                  </td>

                  <td className="px-4 py-4 align-middle text-[12px] font-semibold text-[#059669]">
                    {invoice.paid}
                  </td>

                  <td className="px-4 py-4 align-middle text-[12px] font-semibold text-red-500">
                    {invoice.due}
                  </td>

                  <td className="px-4 py-4 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => onWriteOffSingle(invoice)}
                      className="inline-flex h-[28px] items-center justify-center rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100"
                    >
                      Write Off
                    </button>
                  </td>
                </tr>
              );
            })}

            {invoices.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-14 text-center text-[13px] text-[#94A3B8]"
                >
                  No invoices found for this company.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Partial: "bg-[#DBEAFE] text-[#2563EB]",
    "Needs Resend": "bg-[#FEF3C7] text-[#D97706]",
    Unpaid: "bg-[#FEE2E2] text-red-500",
  };

  return (
    <span
      className={`inline-flex h-[22px] items-center justify-center rounded-full px-3 text-[10px] font-semibold ${
        styles[status] || "bg-[#F1F5F9] text-[#64748B]"
      }`}
    >
      {status}
    </span>
  );
}

function parseInvoiceDate(dateString) {
  const [month, day, year] = dateString.split("/");
  return new Date(Number(year), Number(month) - 1, Number(day));
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

function SendIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M22 2 11 13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m22 2-7 20-4-9-9-4 20-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}