"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import InvoiceReportTable from "@/components/invoices/InvoiceReportTable";
import CurrentDateTime from "@/components/dashboard/CurrentDateTime";
import CreateInvoiceModal from "@/components/orders/CreateInvoiceModal";
import { getInvoices, resendInvoices } from "@/lib/invoices/invoiceApi";

const EMPTY_SUMMARY = {
  companies: 0,
  cases: 0,
  invoiced: "$0.00",
  paid: "$0.00",
  due: "$0.00",
};

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState("outstanding");
  const [filters, setFilters] = useState({
    from: "",
    through: "",
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [outstanding, setOutstanding] = useState({
    groups: [],
    summary: EMPTY_SUMMARY,
    count: 0,
  });
  const [resend, setResend] = useState({
    invoices: [],
    summary: EMPTY_SUMMARY,
    count: 0,
  });

  const loadInvoices = useCallback(async () => {
    setLoading(true);

    try {
      const [outstandingData, resendData] = await Promise.all([
        getInvoices({
          tab: "outstanding",
          dateFrom: filters.from || undefined,
          dateTo: filters.through || undefined,
        }),
        getInvoices({
          tab: "resend",
          dateFrom: filters.from || undefined,
          dateTo: filters.through || undefined,
        }),
      ]);

      setOutstanding(outstandingData);
      setResend(resendData);
    } catch {
      setOutstanding({ groups: [], summary: EMPTY_SUMMARY, count: 0 });
      setResend({ invoices: [], summary: EMPTY_SUMMARY, count: 0 });
    } finally {
      setLoading(false);
    }
  }, [filters.from, filters.through]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices, refreshKey]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFilterByDate = () => {
    setRefreshKey((value) => value + 1);
  };

  const handleReset = () => {
    setFilters({
      from: "",
      through: "",
    });
    setRefreshKey((value) => value + 1);
  };

  const activeSummary =
    activeTab === "resend" ? resend.summary : outstanding.summary;

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
          <InvoiceTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            outstandingCount={outstanding.count}
            resendCount={resend.count}
          />

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

          <InvoiceSummary summary={activeSummary} loading={loading} />
        </div>

        {activeTab === "outstanding" ? (
          <InvoiceReportTable
            invoiceGroups={outstanding.groups}
            loading={loading}
            onRefresh={loadInvoices}
          />
        ) : (
          <ResendInvoicesPanel
            invoices={resend.invoices}
            loading={loading}
            onRefresh={loadInvoices}
          />
        )}
      </div>
    </DashboardShell>
  );
}

function InvoiceTabs({ activeTab, onChange, outstandingCount, resendCount }) {
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
        Outstanding Invoices ({outstandingCount})
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
        Resend Invoices ({resendCount})
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

function InvoiceSummary({ summary, loading }) {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-5 shadow-sm">
      <h2 className="mb-4 text-[13px] font-semibold text-[#334155]">
        Summary
      </h2>

      <div className="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3 xl:grid-cols-5">
        <SummaryItem
          label="Companies"
          value={loading ? "..." : String(summary.companies)}
        />
        <SummaryItem
          label="Cases"
          value={loading ? "..." : String(summary.cases)}
        />
        <SummaryItem
          label="Invoiced"
          value={loading ? "..." : summary.invoiced}
        />
        <SummaryItem
          label="Paid"
          value={loading ? "..." : summary.paid}
          green
        />
        <SummaryItem
          label="Due"
          value={loading ? "..." : summary.due}
          red
        />
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

function ResendInvoicesPanel({ invoices, loading, onRefresh }) {
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [resendingId, setResendingId] = useState(null);
  const [resendError, setResendError] = useState("");

  const allSelected =
    invoices.length > 0 && selectedInvoiceIds.length === invoices.length;

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedInvoiceIds([]);
      return;
    }

    setSelectedInvoiceIds(invoices.map((invoice) => invoice.id));
  };

  const handleToggleInvoice = (invoiceId) => {
    setSelectedInvoiceIds((prev) => {
      if (prev.includes(invoiceId)) {
        return prev.filter((id) => id !== invoiceId);
      }

      return [...prev, invoiceId];
    });
  };

  const handleResendInvoice = async (invoice) => {
    const invoiceId = Number(invoice.invoiceId || invoice.id);

    if (!Number.isFinite(invoiceId) || resendingId) return;

    setResendingId(invoice.id);
    setResendError("");

    try {
      await resendInvoices([invoiceId]);
      onRefresh?.();
    } catch (error) {
      setResendError(error?.message || "Failed to resend invoice");
    } finally {
      setResendingId(null);
    }
  };

  const handleOpenInvoiceModal = (invoice) => {
    setSelectedInvoiceOrder({
      id: invoice.caseNo,
      dbId: invoice.orderId,
      invoiceId: invoice.invoiceId || invoice.id,
      applicant: invoice.applicant || invoice.caseNo,
      court: "N/A",
      company: {
        name: invoice.company,
      },
      invoice: {
        invoiceId: invoice.invoiceId || invoice.id,
        date: invoice.invoiceDate,
        sentDate: invoice.sentDate,
        invoiced: invoice.invoiced,
        paid: invoice.paid,
        due: invoice.due,
      },
    });
  };

  return (
    <>
      {resendError && (
        <p className="rounded-[6px] border border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-600">
          {resendError}
        </p>
      )}

      <section className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
        <div className="h-full max-h-[calc(100vh-330px)] overflow-auto">
          <table className="w-full min-w-[1150px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#F8FAFC]">
              <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
                <th className="w-[48px] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleToggleAll}
                    className="h-[13px] w-[13px] rounded border-[#CBD5E1] accent-[#0097B2]"
                  />
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
              {loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-14 text-center text-[13px] text-[#94A3B8]"
                  >
                    Loading resend invoices...
                  </td>
                </tr>
              )}

              {!loading &&
                invoices.map((invoice) => {
                  const isSelected = selectedInvoiceIds.includes(invoice.id);

                  return (
                    <tr
                      key={invoice.id}
                      className="border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#FCFEFF] hover:bg-[#F8FBFC]"
                    >
                      <td className="px-4 py-4 align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleInvoice(invoice.id)}
                          className="h-[13px] w-[13px] rounded border-[#CBD5E1] accent-[#0097B2]"
                        />
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
                          <Link
                            href={`/orders/new?mode=edit&orderId=${encodeURIComponent(
                              invoice.orderId
                            )}`}
                            className="font-semibold text-[#007F96] hover:underline"
                          >
                            {invoice.caseNo}
                          </Link>

                          {invoice.isSent ? (
                            <span className="text-[#94A3B8]">(invoice sent)</span>
                          ) : (
                            <span className="text-[#94A3B8]">(not sent)</span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenInvoiceModal(invoice)}
                            className={`font-semibold hover:underline ${
                              invoice.isSent ? "text-red-500" : "text-[#475569]"
                            }`}
                          >
                            {invoice.sentDate}
                          </button>

                          <span className="text-[#64748B]">
                            ({invoice.days} days)
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-middle text-[12px] text-[#475569]">
                        <button
                          type="button"
                          onClick={() => handleOpenInvoiceModal(invoice)}
                          className="text-[#475569] hover:text-[#007F96] hover:underline"
                        >
                          {invoice.invoiceDate}
                        </button>
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
                          disabled={resendingId === invoice.id}
                          onClick={() => handleResendInvoice(invoice)}
                          className="inline-flex h-[28px] items-center justify-center rounded-[6px] border border-[#67D8E8] bg-[#E6F7FA] px-3 text-[11px] font-semibold text-[#007F96] hover:bg-[#DDF6FA] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {resendingId === invoice.id ? "Sending..." : "Resend"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {!loading && invoices.length === 0 && (
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

      <CreateInvoiceModal
        isOpen={Boolean(selectedInvoiceOrder)}
        mode="edit"
        order={selectedInvoiceOrder}
        onClose={() => setSelectedInvoiceOrder(null)}
        onSaved={onRefresh}
      />
    </>
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
