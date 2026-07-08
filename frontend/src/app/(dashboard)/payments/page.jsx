"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import PaymentsTable from "@/components/payments/PaymentsTable";
import ManualPaymentModal from "@/components/payments/ManualPaymentModal";
import CurrentDateTime from "@/components/dashboard/CurrentDateTime";
import {
  buildManualSummary,
  buildOnlineSummary,
  filterPaymentsByInvoiceId,
  filterPaymentsByOrderId,
  getPayments,
} from "@/lib/payments/paymentApi";

const EMPTY_MANUAL_SUMMARY = {
  totalPayments: 0,
  totalAmount: "$0.00",
  checkCount: 0,
  wireCount: 0,
  pendingCount: 0,
};

const EMPTY_ONLINE_SUMMARY = {
  totalTransactions: 0,
  totalCollected: "$0.00",
  succeededCount: 0,
  pendingCount: 0,
  failedCount: 0,
};

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const initialChannel =
    searchParams.get("channel") === "online" ? "online" : "manual";
  const [paymentType, setPaymentType] = useState(initialChannel);
  const [filters, setFilters] = useState({
    from: "",
    through: "",
    orderId: "",
  });
  const [appliedOrderId, setAppliedOrderId] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [appliedInvoiceSearch, setAppliedInvoiceSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [manualPaymentModalOpen, setManualPaymentModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manualData, setManualData] = useState({
    payments: [],
    summary: EMPTY_MANUAL_SUMMARY,
    count: 0,
  });
  const [onlineData, setOnlineData] = useState({
    payments: [],
    summary: EMPTY_ONLINE_SUMMARY,
    count: 0,
  });

  const loadPayments = useCallback(async () => {
    setLoading(true);

    const dateFilters = {
      dateFrom: filters.from || undefined,
      dateTo: filters.through || undefined,
    };

    try {
      const [manualResult, onlineResult] = await Promise.all([
        getPayments({ ...dateFilters, type: "manual" }),
        getPayments({ ...dateFilters, type: "online" }),
      ]);

      setManualData(manualResult);
      setOnlineData(onlineResult);
    } catch {
      setManualData({
        payments: [],
        summary: EMPTY_MANUAL_SUMMARY,
        count: 0,
      });
      setOnlineData({
        payments: [],
        summary: EMPTY_ONLINE_SUMMARY,
        count: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [filters.from, filters.through]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments, refreshKey]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAppliedInvoiceSearch(invoiceSearch.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [invoiceSearch]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApplyFilters = () => {
    setAppliedOrderId(filters.orderId.trim());
    setRefreshKey((value) => value + 1);
  };

  const handleReset = () => {
    setFilters({
      from: "",
      through: "",
      orderId: "",
    });
    setAppliedOrderId("");
    setInvoiceSearch("");
    setAppliedInvoiceSearch("");
    setRefreshKey((value) => value + 1);
  };

  const filterByOrderId = useCallback(
    (rows) => filterPaymentsByOrderId(rows, appliedOrderId),
    [appliedOrderId]
  );

  const filterByInvoiceId = useCallback(
    (rows) => filterPaymentsByInvoiceId(rows, appliedInvoiceSearch),
    [appliedInvoiceSearch]
  );

  const filteredManualPayments = useMemo(
    () => filterByInvoiceId(filterByOrderId(manualData.payments)),
    [manualData.payments, filterByOrderId, filterByInvoiceId]
  );
  const filteredOnlinePayments = useMemo(
    () => filterByInvoiceId(filterByOrderId(onlineData.payments)),
    [onlineData.payments, filterByOrderId, filterByInvoiceId]
  );

  const isManual = paymentType === "manual";
  const currentPayments = isManual
    ? filteredManualPayments
    : filteredOnlinePayments;

  const currentSummary = useMemo(() => {
    if (loading) {
      return isManual ? manualData.summary : onlineData.summary;
    }

    return isManual
      ? buildManualSummary(filteredManualPayments)
      : buildOnlineSummary(filteredOnlinePayments);
  }, [
    filteredManualPayments,
    filteredOnlinePayments,
    isManual,
    loading,
    manualData.summary,
    onlineData.summary,
  ]);

  const manualTabCount = filteredManualPayments.length;
  const onlineTabCount = filteredOnlinePayments.length;

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[18px] font-semibold text-[#111827]">
              DMS Payments
            </h1>
            <p className="mt-1 text-[12px] text-[#64748B]">
              Track manual payments and online Stripe transactions in one place.
            </p>
          </div>

          <CurrentDateTime
            variant="short"
            prefix="as of"
            className="text-[12px] text-[#94A3B8]"
          />
        </div>

        <GlobalInvoiceSearch
          value={invoiceSearch}
          onChange={setInvoiceSearch}
          onClear={() => {
            setInvoiceSearch("");
            setAppliedInvoiceSearch("");
          }}
        />

        <div className="flex flex-col gap-3 border-b border-[#E2E8F0] pb-0">
          <PaymentTypeTabs
            activeType={paymentType}
            onChange={setPaymentType}
            manualCount={manualTabCount}
            onlineCount={onlineTabCount}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(520px,650px)]">
          <PaymentFilters
            filters={filters}
            onChange={handleFilterChange}
            onFilter={handleApplyFilters}
            onReset={handleReset}
          />

          <PaymentSummary
            paymentType={paymentType}
            summary={currentSummary}
            loading={loading}
          />
        </div>

        {isManual ? (
          <ManualPaymentPrompt
            onAddPayment={() => setManualPaymentModalOpen(true)}
          />
        ) : (
          <OnlinePaymentsInfo />
        )}

        <ManualPaymentModal
          isOpen={manualPaymentModalOpen}
          onClose={() => setManualPaymentModalOpen(false)}
          onSaved={() => setRefreshKey((value) => value + 1)}
        />

        <PaymentsTable
          payments={currentPayments}
          loading={loading}
          paymentType={paymentType}
        />
      </div>
    </DashboardShell>
  );
}

function GlobalInvoiceSearch({ value, onChange, onClear }) {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label
          htmlFor="global-invoice-search"
          className="shrink-0 text-[12px] font-semibold text-[#334155]"
        >
          Search by Invoice ID
        </label>

        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-3">
          <SearchIcon />
          <input
            id="global-invoice-search"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter invoice number or ID (e.g. INV-24018)"
            className="h-[38px] min-w-0 flex-1 bg-transparent text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8]"
          />
          {value ? (
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 text-[11px] font-semibold text-[#64748B] hover:text-[#334155]"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SearchIcon() {
  return (
    <svg
      className="shrink-0 text-[#94A3B8]"
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

function PaymentTypeTabs({ activeType, onChange, manualCount, onlineCount }) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto">
      <button
        type="button"
        onClick={() => onChange("manual")}
        className={`whitespace-nowrap rounded-t-[8px] border-b-2 px-5 py-3 text-[13px] font-semibold transition ${
          activeType === "manual"
            ? "border-[#0097B2] bg-[#E6F7FA] text-[#007F96]"
            : "border-transparent text-[#64748B] hover:bg-[#F8FAFC]"
        }`}
      >
        Manual Payments ({manualCount})
      </button>

      <button
        type="button"
        onClick={() => onChange("online")}
        className={`whitespace-nowrap rounded-t-[8px] border-b-2 px-5 py-3 text-[13px] font-semibold transition ${
          activeType === "online"
            ? "border-[#0097B2] bg-[#E6F7FA] text-[#007F96]"
            : "border-transparent text-[#64748B] hover:bg-[#F8FAFC]"
        }`}
      >
        Online Payments ({onlineCount})
      </button>
    </div>
  );
}

function PaymentFilters({ filters, onChange, onFilter, onReset }) {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-5 shadow-sm">
      <h2 className="mb-4 text-[13px] font-semibold text-[#334155]">
        Filters
      </h2>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <TextField
          label="Order ID"
          name="orderId"
          value={filters.orderId}
          onChange={onChange}
          placeholder="Enter order number"
        />

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
          Apply Filters
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

function TextField({ label, name, value, onChange, placeholder = "" }) {
  return (
    <div className="min-w-0 flex-1 lg:max-w-[180px]">
      <label className="mb-2 block text-[11px] font-medium text-[#64748B]">
        {label}
      </label>

      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-[38px] w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
      />
    </div>
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

function PaymentSummary({ paymentType, summary, loading }) {
  const isManual = paymentType === "manual";

  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-5 shadow-sm">
      <h2 className="mb-4 text-[13px] font-semibold text-[#334155]">
        Summary
      </h2>

      {isManual ? (
        <div className="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3 xl:grid-cols-5">
          <SummaryItem
            label="Total Payments"
            value={loading ? "..." : String(summary.totalPayments)}
          />
          <SummaryItem
            label="Total Amount"
            value={loading ? "..." : summary.totalAmount}
          />
          <SummaryItem
            label="Checks"
            value={loading ? "..." : String(summary.checkCount)}
          />
          <SummaryItem
            label="Wire Transfers"
            value={loading ? "..." : String(summary.wireCount)}
          />
          <SummaryItem
            label="Pending Review"
            value={loading ? "..." : String(summary.pendingCount)}
            red={summary.pendingCount > 0}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3 xl:grid-cols-5">
          <SummaryItem
            label="Transactions"
            value={loading ? "..." : String(summary.totalTransactions)}
          />
          <SummaryItem
            label="Collected"
            value={loading ? "..." : summary.totalCollected}
            green
          />
          <SummaryItem
            label="Succeeded"
            value={loading ? "..." : String(summary.succeededCount)}
            green
          />
          <SummaryItem
            label="Pending"
            value={loading ? "..." : String(summary.pendingCount)}
          />
          <SummaryItem
            label="Failed"
            value={loading ? "..." : String(summary.failedCount)}
            red={summary.failedCount > 0}
          />
        </div>
      )}
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

function ManualPaymentPrompt({ onAddPayment }) {
  return (
    <section className="flex flex-col gap-4 rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-[13px] font-semibold text-[#334155]">
          Got a manual payment?
        </h2>
        <p className="mt-1 text-[12px] text-[#64748B]">
          Update details by searching the order and recording the check information.
        </p>
      </div>

      <button
        type="button"
        onClick={onAddPayment}
        className="h-[38px] shrink-0 rounded-[6px] bg-[#0097B2] px-5 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
      >
        Add New Payment
      </button>
    </section>
  );
}

function OnlinePaymentsInfo() {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold text-[#334155]">
            Online Payment Details
          </h2>
          <p className="mt-2 text-[12px] leading-6 text-[#64748B]">
            Online payments will be processed through Stripe. Customers can pay
            invoices by card or ACH, and transactions will appear here with Stripe
            payment IDs, status, and receipt details.
          </p>
        </div>

        <div className="shrink-0 rounded-[8px] border border-[#CFFAFE] bg-[#E6F7FA] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#007F96]">
            Stripe Integration
          </p>
          <p className="mt-1 text-[12px] text-[#334155]">
            Coming soon — connect Stripe to enable live online payments.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <InfoCard
          title="Payment Methods"
          items={["Credit / Debit Card", "ACH Bank Transfer"]}
        />
        <InfoCard
          title="Transaction Status"
          items={[
            "Succeeded — funds captured",
            "Pending — authorization in progress",
            "Failed — payment declined or expired",
          ]}
        />
        <InfoCard
          title="Stripe Fields"
          items={[
            "Payment Intent ID",
            "Customer email",
            "Card last 4 digits",
            "Amount and invoice reference",
          ]}
        />
      </div>
    </section>
  );
}

function InfoCard({ title, items }) {
  return (
    <div className="rounded-[8px] border border-[#E2E8F0] bg-white px-4 py-3">
      <h3 className="text-[12px] font-semibold text-[#334155]">{title}</h3>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-[11px] text-[#64748B]">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
