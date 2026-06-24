"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import CreateInvoiceModal from "@/components/orders/CreateInvoiceModal";
import CreateXrayInvoiceModal from "@/components/orders/CreateXrayInvoiceModal";
import WriteOffInvoiceModal from "@/components/invoices/WriteOffInvoiceModal";
import { getCompanyInvoices, writeOffInvoices as submitWriteOffInvoices } from "@/lib/invoices/invoiceApi";
import { canWriteOffInvoice } from "@/lib/invoices/invoiceUtils";

const EMPTY_SUMMARY = {
  totalCases: 0,
  needsResend: 0,
  totalInvoiced: "$0.00",
  totalPaid: "$0.00",
  totalDue: "$0.00",
};

function buildWriteOffInvoice(company, invoice) {
  return {
    id: invoice.id,
    invoiceId: invoice.invoiceDbId || invoice.id,
    orderId: invoice.orderId,
    caseNo: invoice.invoiceId,
    company: company.name,
    email: company.email,
    sentDate: invoice.invoiceDate,
    invoiceDate: invoice.invoiceDate,
    status: invoice.status,
    invoiced: invoice.invoiced,
    paid: invoice.paid,
    due: invoice.due,
  };
}

export default function CompanyInvoiceDetailsPage() {
  const params = useParams();
  const companyId = String(params.companyId);

  const [company, setCompany] = useState({
    id: companyId,
    name: "Company",
    email: "",
  });
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  const [selectedXrayOrder, setSelectedXrayOrder] = useState(null);
  const [writeOffInvoices, setWriteOffInvoices] = useState([]);
  const [writeOffError, setWriteOffError] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    fromDate: "",
    toDate: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCompanyInvoices() {
      setLoading(true);

      try {
        const data = await getCompanyInvoices(companyId, {
          dateFrom: filters.fromDate || undefined,
          dateTo: filters.toDate || undefined,
        });

        if (cancelled) return;

        setCompany(data.company);
        setInvoices(data.invoices);
        setSummary(data.summary);
        setSelectedIds([]);
      } catch {
        if (!cancelled) {
          setCompany({ id: companyId, name: "Company", email: "" });
          setInvoices([]);
          setSummary(EMPTY_SUMMARY);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCompanyInvoices();

    return () => {
      cancelled = true;
    };
  }, [companyId, filters.fromDate, filters.toDate]);

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

  const writableSelectedInvoices = useMemo(() => {
    return selectedInvoices.filter((invoice) => canWriteOffInvoice(invoice));
  }, [selectedInvoices]);

  const filteredInvoiceIds = filteredInvoices.map((invoice) => invoice.id);

  const allSelected =
    filteredInvoices.length > 0 &&
    filteredInvoiceIds.every((id) => selectedIds.includes(id));

  const selectedCount = selectedIds.length;
  const hasSelectedInvoices = selectedCount > 0;
  const writableSelectedCount = writableSelectedInvoices.length;
  const hasWritableSelected = writableSelectedCount > 0;

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
    if (writableSelectedInvoices.length === 0) return;

    const selectedWriteOffInvoices = writableSelectedInvoices.map((invoice) =>
      buildWriteOffInvoice(company, invoice)
    );

    setWriteOffInvoices(selectedWriteOffInvoices);
  };

  const handleWriteOffSingle = (invoice) => {
    if (!canWriteOffInvoice(invoice)) return;

    setWriteOffInvoices([buildWriteOffInvoice(company, invoice)]);
  };

  const reloadCompanyInvoices = async () => {
    const data = await getCompanyInvoices(companyId, {
      dateFrom: filters.fromDate || undefined,
      dateTo: filters.toDate || undefined,
    });

    setCompany(data.company);
    setInvoices(data.invoices);
    setSummary(data.summary);
  };

  const handleSubmitWriteOff = async (payload) => {
    setWriteOffError("");

    try {
      await submitWriteOffInvoices(payload);

      setSelectedIds((prev) =>
        prev.filter(
          (selectedId) =>
            !payload.invoices.some((invoice) => invoice.id === selectedId)
        )
      );

      setWriteOffInvoices([]);

      await reloadCompanyInvoices();
    } catch (error) {
      setWriteOffError(error?.message || "Failed to write off invoices");
      console.error("Failed to write off invoices:", error);
    }
  };

  const handleOpenEditInvoice = (invoice) => {
    if (invoice.invoiceType === "xray") {
      setSelectedXrayOrder({
        id: invoice.invoiceId,
        dbId: invoice.orderId,
        applicant: invoice.invoiceId,
        court: "N/A",
        company: {
          name: company.name,
        },
        invoice: {
          date: invoice.invoiceDate,
          sentDate: invoice.invoiceDate,
          invoiced: invoice.invoiced,
          paid: invoice.paid,
          due: invoice.due,
        },
      });
      return;
    }

    setSelectedInvoiceOrder({
      id: invoice.invoiceId,
      dbId: invoice.orderId,
      invoiceId: invoice.invoiceDbId || invoice.id,
      applicant: invoice.invoiceId,
      court: "N/A",
      company: {
        name: company.name,
      },
      invoice: {
        invoiceId: invoice.invoiceDbId || invoice.id,
        date: invoice.invoiceDate,
        sentDate: invoice.invoiceDate,
        invoiced: invoice.invoiced,
        paid: invoice.paid,
        due: invoice.due,
        status: invoice.status,
      },
    });
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
              disabled={!hasWritableSelected}
              className={`inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] border px-4 text-[12px] font-semibold transition disabled:cursor-not-allowed ${
                hasWritableSelected
                  ? "border-red-500 bg-red-500 text-white shadow-sm hover:bg-red-600"
                  : "border-[#E2E8F0] bg-white text-[#94A3B8] opacity-70"
              }`}
            >
              <CircleIcon />
              Write Off Selected ({writableSelectedCount})
            </button>
          </div>
        </div>

        <SummaryCards summary={summary} selectedCount={selectedCount} loading={loading} />

        {writeOffError && (
          <p className="rounded-[6px] border border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-600">
            {writeOffError}
          </p>
        )}

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
          loading={loading}
          onToggleAll={handleToggleAll}
          onToggleInvoice={handleToggleInvoice}
          onWriteOffSingle={handleWriteOffSingle}
          onOpenEditInvoice={handleOpenEditInvoice}
        />
      </div>

      <CreateInvoiceModal
        isOpen={Boolean(selectedInvoiceOrder)}
        mode="edit"
        order={selectedInvoiceOrder}
        onClose={() => setSelectedInvoiceOrder(null)}
        onSaved={reloadCompanyInvoices}
      />

      <CreateXrayInvoiceModal
        isOpen={Boolean(selectedXrayOrder)}
        order={selectedXrayOrder}
        onClose={() => setSelectedXrayOrder(null)}
        onSaved={reloadCompanyInvoices}
      />

      <WriteOffInvoiceModal
        isOpen={writeOffInvoices.length > 0}
        invoices={writeOffInvoices}
        onClose={() => setWriteOffInvoices([])}
        onSubmit={handleSubmitWriteOff}
      />
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

function SummaryCards({ summary, selectedCount, loading }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <SummaryCard
        label="Total Cases"
        value={loading ? "..." : String(summary.totalCases)}
      />
      <SummaryCard
        label="Needs Resend"
        value={loading ? "..." : String(summary.needsResend)}
        orange
      />
      <SummaryCard
        label="Total Invoiced"
        value={loading ? "..." : summary.totalInvoiced}
      />
      <SummaryCard
        label="Total Paid"
        value={loading ? "..." : summary.totalPaid}
        green
      />
      <SummaryCard
        label="Total Due"
        value={loading ? "..." : summary.totalDue}
        red
      />
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
  loading,
  onToggleAll,
  onToggleInvoice,
  onWriteOffSingle,
  onOpenEditInvoice,
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
                  className="h-[13px] w-[13px] rounded border-[#CBD5E1] accent-[#0097B2]"
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
            {loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-14 text-center text-[13px] text-[#94A3B8]"
                >
                  Loading invoices...
                </td>
              </tr>
            )}

            {!loading &&
              invoices.map((invoice) => {
              const selected = selectedIds.includes(invoice.id);
              const rowClassName = invoice.isWrittenOff
                ? "border-b border-[#F1F5F9] last:border-b-0 bg-[#FAFAFA] text-[#94A3B8] line-through decoration-[#94A3B8] [&_a]:text-[#94A3B8] [&_button:not(:disabled)]:text-[#94A3B8]"
                : "border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#FCFEFF] hover:bg-[#F8FBFC]";

              return (
                <tr key={invoice.id} className={rowClassName}>
                  <td className="px-4 py-4 align-middle">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleInvoice(invoice.id)}
                      className="h-[13px] w-[13px] rounded border-[#CBD5E1] accent-[#0097B2]"
                    />
                  </td>

                  <td className="px-4 py-4 align-middle">
                    <Link
                      href={`/orders/new?mode=edit&orderId=${encodeURIComponent(
                        invoice.orderId || invoice.invoiceId
                      )}`}
                      className="text-[12px] font-semibold text-[#007F96] hover:underline"
                    >
                      {invoice.invoiceId}
                    </Link>

                    {invoice.invoiceType === "xray" && (
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#7C3AED]">
                        X-Ray Invoice
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-4 align-middle">
                    <button
                      type="button"
                      onClick={() => onOpenEditInvoice(invoice)}
                      className="text-left text-[12px] font-semibold text-red-500 hover:underline"
                    >
                      {invoice.invoiceDate}
                    </button>

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
                    {!invoice.isWrittenOff && (
                      <button
                        type="button"
                        onClick={() => onWriteOffSingle(invoice)}
                        disabled={!canWriteOffInvoice(invoice)}
                        className="inline-flex h-[28px] items-center justify-center rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Write Off
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {!loading && invoices.length === 0 && (
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
    Paid: "bg-[#ECFDF5] text-[#059669]",
    "Written Off": "bg-[#F3E8FF] text-[#7C3AED]",
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