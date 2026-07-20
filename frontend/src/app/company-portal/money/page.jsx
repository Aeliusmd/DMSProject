"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CompanyPortalDashboardShell from "@/components/company-portal/CompanyPortalDashboardShell";
import PrimaryButton from "@/components/ui/PrimaryButton";
import AuthInput from "@/components/ui/AuthInput";
import { getCompanyCurrentUser } from "@/lib/company-portal/companyPortalAuthApi";
import { isCompanyAuthenticated, getStoredCompanyUser } from "@/lib/company-portal/companyPortalAuthStorage";
import {
  allocateCompanyWalletFunds,
  confirmCompanyWalletTopup,
  createCompanyWalletTopup,
  formatMoney,
  getCompanyWalletSummary,
  listCompanyEmployees,
  listCompanyWalletTransactions,
} from "@/lib/company-portal/companyPortalManagementApi";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";
import { sanitizeMoneyInput } from "@/lib/company-portal/companyPortalValidation";

const TRANSACTIONS_PAGE_SIZE = 10;

function MoneyManagementClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [topupAmount, setTopupAmount] = useState("100");
  const [topupLoading, setTopupLoading] = useState(false);
  const [allocateForm, setAllocateForm] = useState({ employeeId: "", amount: "" });
  const [allocateLoading, setAllocateLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState([null]);
  const cursorHistoryRef = useRef([null]);
  const [pagination, setPagination] = useState({
    pageSize: TRANSACTIONS_PAGE_SIZE,
    hasMore: false,
    nextCursor: null,
  });
  const txRequestIdRef = useRef(0);

  useEffect(() => {
    cursorHistoryRef.current = cursorHistory;
  }, [cursorHistory]);

  const loadTransactionsPage = useCallback(
    async ({ page = 1, cursor = null } = {}) => {
      const requestId = (txRequestIdRef.current += 1);
      setTxLoading(true);

      try {
        const response = await listCompanyWalletTransactions({
          cursor,
          pageSize: TRANSACTIONS_PAGE_SIZE,
        });
        if (requestId !== txRequestIdRef.current) return;

        const data = response?.data || {};
        const pageMeta = data.pagination || {};
        setTransactions(data.transactions || []);
        setPagination({
          pageSize: Number(pageMeta.pageSize) || TRANSACTIONS_PAGE_SIZE,
          hasMore: Boolean(pageMeta.hasMore),
          nextCursor: pageMeta.nextCursor || null,
        });
        setCurrentPage(page);
        setCursorHistory((prev) => {
          const next = prev.slice(0, page - 1);
          next[page - 1] = cursor;
          if (pageMeta.hasMore && pageMeta.nextCursor) {
            next[page] = pageMeta.nextCursor;
          }
          return next;
        });
      } catch (err) {
        if (requestId !== txRequestIdRef.current) return;
        setTransactions([]);
        setPagination({
          pageSize: TRANSACTIONS_PAGE_SIZE,
          hasMore: false,
          nextCursor: null,
        });
        setError(getApiErrorMessage(err, "Unable to load wallet transactions"));
      } finally {
        if (requestId === txRequestIdRef.current) setTxLoading(false);
      }
    },
    []
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [walletResponse, employeeResponse] = await Promise.all([
        getCompanyWalletSummary(),
        listCompanyEmployees(),
      ]);
      setSummary(walletResponse?.data || null);
      setEmployees(employeeResponse?.data?.employees || []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load wallet summary"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isCompanyAuthenticated()) {
      router.replace("/company-portal/login");
      return;
    }

    const user = getStoredCompanyUser();
    if (user && user.isAdmin === false) {
      router.replace("/company-portal/dashboard");
      return;
    }

    getCompanyCurrentUser().catch(() => router.replace("/company-portal/login"));
    loadData();
    loadTransactionsPage({ page: 1, cursor: null });
  }, [router, loadData, loadTransactionsPage]);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const topupStatus = searchParams.get("topup");

    if (topupStatus === "success" && sessionId) {
      confirmCompanyWalletTopup(sessionId)
        .then((response) => {
          setSummary(response?.data || null);
          setSuccessMessage("Wallet top-up completed successfully.");
          const nextHistory = [null];
          cursorHistoryRef.current = nextHistory;
          setCursorHistory(nextHistory);
          loadTransactionsPage({ page: 1, cursor: null });
          router.replace("/company-portal/money");
        })
        .catch((err) => {
          setError(getApiErrorMessage(err, "Unable to confirm wallet top-up"));
        });
    } else if (topupStatus === "canceled") {
      setError("Wallet top-up was canceled.");
      router.replace("/company-portal/money");
    }
  }, [searchParams, router, loadTransactionsPage]);

  const cards = useMemo(
    () => [
      {
        label: "Total balance",
        value: formatMoney(summary?.totalBalance),
        hint: "Unallocated + allocated to employees",
      },
      {
        label: "Unallocated",
        value: formatMoney(summary?.unallocatedBalance),
        hint: "Available to allocate to employees",
      },
      {
        label: "Allocated",
        value: formatMoney(summary?.allocatedBalance),
        hint: "Currently assigned to employee wallets",
      },
    ],
    [summary]
  );

  const handleTopup = async () => {
    setTopupLoading(true);
    setError("");
    try {
      const amount = Number(sanitizeMoneyInput(topupAmount));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a valid top-up amount");
      }
      const response = await createCompanyWalletTopup(amount);
      const checkoutUrl = response?.data?.checkoutUrl;
      if (!checkoutUrl) throw new Error("Unable to start Stripe checkout");
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to start wallet top-up"));
      setTopupLoading(false);
    }
  };

  const handleAllocate = async (event) => {
    event.preventDefault();
    setAllocateLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const amount = Number(sanitizeMoneyInput(allocateForm.amount));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a valid amount");
      }
      const response = await allocateCompanyWalletFunds({
        employeeId: Number(allocateForm.employeeId),
        amount,
      });
      setSummary(response?.data || null);
      setAllocateForm({ employeeId: "", amount: "" });
      setSuccessMessage("Funds allocated to employee successfully.");
      const employeeResponse = await listCompanyEmployees();
      setEmployees(employeeResponse?.data?.employees || []);
      const nextHistory = [null];
      cursorHistoryRef.current = nextHistory;
      setCursorHistory(nextHistory);
      await loadTransactionsPage({ page: 1, cursor: null });
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to allocate funds"));
    } finally {
      setAllocateLoading(false);
    }
  };

  const goPrev = () => {
    if (currentPage <= 1 || txLoading) return;
    const prevPage = currentPage - 1;
    const cursor = cursorHistoryRef.current[prevPage - 1] ?? null;
    loadTransactionsPage({ page: prevPage, cursor });
  };

  const goNext = () => {
    if (!pagination.hasMore || txLoading) return;
    const nextPage = currentPage + 1;
    const cursor =
      pagination.nextCursor || cursorHistoryRef.current[currentPage] || null;
    if (!cursor) return;
    loadTransactionsPage({ page: nextPage, cursor });
  };

  return (
    <CompanyPortalDashboardShell title="Money Management">
      <div className="space-y-6">
        <div>
          <h2 className="text-[18px] font-semibold text-[#0F172A]">
            Company wallet
          </h2>
          <p className="mt-1 text-[13px] text-[#64748B]">
            Top up funds with Stripe, allocate balances to employees, and track
            wallet activity.
          </p>
        </div>

        {successMessage ? (
          <p className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm"
            >
              <p className="text-[12px] font-medium text-[#64748B]">
                {card.label}
              </p>
              <p className="mt-2 text-[24px] font-semibold text-[#0F172A]">
                {loading ? "..." : card.value}
              </p>
              <p className="mt-1 text-[11px] text-[#94A3B8]">{card.hint}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h3 className="text-[15px] font-semibold text-[#0F172A]">
              Top up wallet
            </h3>
            <p className="mt-1 text-[12px] text-[#64748B]">
              Add funds to your company wallet using Stripe.
            </p>
            <div className="mt-4 space-y-4">
              <AuthInput
                label="Amount (USD)"
                type="number"
                min="10"
                step="0.01"
                value={topupAmount}
                onChange={(event) =>
                  setTopupAmount(sanitizeMoneyInput(event.target.value))
                }
                placeholder="100.00"
              />
              <PrimaryButton
                type="button"
                onClick={handleTopup}
                disabled={topupLoading}
              >
                {topupLoading ? "Redirecting..." : "Top up with Stripe"}
              </PrimaryButton>
            </div>
          </section>

          <section className="rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h3 className="text-[15px] font-semibold text-[#0F172A]">
              Allocate to employee
            </h3>
            <p className="mt-1 text-[12px] text-[#64748B]">
              Move unallocated funds into an employee wallet for order payments.
            </p>
            <form onSubmit={handleAllocate} className="mt-4 space-y-4">
              <label className="block text-[12px] font-medium text-[#334155]">
                Employee
                <select
                  value={allocateForm.employeeId}
                  onChange={(event) =>
                    setAllocateForm((prev) => ({
                      ...prev,
                      employeeId: event.target.value,
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-[8px] border border-[#E2E8F0] px-3 text-[13px] outline-none focus:border-[#0097B2]"
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({formatMoney(employee.walletBalance)})
                    </option>
                  ))}
                </select>
              </label>
              <AuthInput
                label="Amount (USD)"
                type="number"
                min="0.01"
                step="0.01"
                value={allocateForm.amount}
                onChange={(event) =>
                  setAllocateForm((prev) => ({
                    ...prev,
                    amount: sanitizeMoneyInput(event.target.value),
                  }))
                }
                placeholder="50.00"
              />
              <PrimaryButton type="submit" disabled={allocateLoading}>
                {allocateLoading ? "Allocating..." : "Allocate funds"}
              </PrimaryButton>
            </form>
          </section>
        </div>

        <section className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
          <div className="border-b border-[#F1F5F9] px-5 py-4">
            <h3 className="text-[15px] font-semibold text-[#0F172A]">
              Recent transactions
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {txLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-[#94A3B8]"
                    >
                      Loading transactions...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-[#94A3B8]"
                    >
                      No wallet transactions yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-t border-[#F1F5F9] text-[#334155]"
                    >
                      <td className="px-5 py-3">
                        {tx.createdAt
                          ? new Date(tx.createdAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-5 py-3 capitalize">
                        {String(tx.type || "").replace(/_/g, " ")}
                      </td>
                      <td className="px-5 py-3">{formatMoney(tx.amount)}</td>
                      <td className="px-5 py-3">{tx.employeeName || "—"}</td>
                      <td className="px-5 py-3">{tx.description || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#F1F5F9] px-5 py-3">
            <p className="text-[11px] text-[#64748B]">
              Page {currentPage}
              {pagination.hasMore ? " · more available" : ""}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={currentPage <= 1 || txLoading}
                className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-3 text-[12px] font-medium text-[#334155] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!pagination.hasMore || txLoading}
                className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-3 text-[12px] font-medium text-[#334155] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </CompanyPortalDashboardShell>
  );
}

export default function CompanyMoneyManagementPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-[13px] text-[#64748B]">
          Loading money management...
        </main>
      }
    >
      <MoneyManagementClient />
    </Suspense>
  );
}
