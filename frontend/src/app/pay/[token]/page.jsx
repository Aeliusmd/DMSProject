"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchPaymentPage, startCheckout } from "@/lib/payments/publicPayApi";

function StatusBadge({ status, isPaid }) {
  const label = isPaid ? "Paid" : status || "Unpaid";
  const styles = isPaid
    ? "bg-[#ECFDF5] text-[#059669]"
    : "bg-[#FEE2E2] text-[#DC2626]";

  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-full px-3 text-[10px] font-semibold ${styles}`}
    >
      {label}
    </span>
  );
}

export default function PublicPayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = `${params?.token || ""}`;
  const canceled = searchParams.get("canceled") === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [processingType, setProcessingType] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid payment link.");
      setLoading(false);
      return;
    }

    let active = true;

    fetchPaymentPage(token)
      .then((data) => {
        if (!active) return;
        setPageData(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "Unable to load payment page.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const handlePay = async (invoiceType) => {
    setProcessingType(invoiceType);
    setError("");

    try {
      const result = await startCheckout(token, invoiceType);
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      throw new Error("Unable to start checkout.");
    } catch (err) {
      setError(err.message || "Unable to start payment.");
      setProcessingType("");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-10">
      <section className="w-full max-w-[640px] rounded-[12px] border border-[#E2E8F0] bg-white p-8 shadow-sm">
        <h1 className="text-[20px] font-semibold text-[#111827]">Pay Invoice Online</h1>
        <p className="mt-2 text-[13px] text-[#64748B]">
          Review your invoice details below and proceed with secure online payment.
        </p>

        {canceled ? (
          <p className="mt-4 rounded-[8px] bg-[#FEF3C7] px-4 py-3 text-[12px] text-[#B45309]">
            Payment was canceled. You can select an invoice below to try again.
          </p>
        ) : null}

        {loading ? (
          <p className="mt-8 text-[13px] text-[#94A3B8]">Loading invoice details...</p>
        ) : error ? (
          <p className="mt-8 text-[13px] font-medium text-red-500">{error}</p>
        ) : pageData ? (
          <>
            <div className="mt-6 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="text-[12px] text-[#64748B]">
                <span className="font-semibold text-[#334155]">Order:</span>{" "}
                {pageData.order?.orderNumber}
              </p>
              <p className="mt-1 text-[12px] text-[#64748B]">
                <span className="font-semibold text-[#334155]">Case #:</span>{" "}
                {pageData.order?.caseNo || "—"}
              </p>
              <p className="mt-1 text-[12px] text-[#64748B]">
                <span className="font-semibold text-[#334155]">Company:</span>{" "}
                {pageData.order?.company}
              </p>
              <p className="mt-1 text-[12px] text-[#64748B]">
                <span className="font-semibold text-[#334155]">Applicant:</span>{" "}
                {pageData.order?.applicant}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#64748B]">
                Invoices for this order
              </p>

              {pageData.invoices?.map((invoice) => {
                const isDisabled = invoice.isPaid || processingType;
                const isProcessing = processingType === invoice.type;

                return (
                  <article
                    key={invoice.type}
                    className={`rounded-[8px] border p-4 ${
                      invoice.isPaid
                        ? "border-[#D1FAE5] bg-[#F0FDF4]"
                        : "border-[#E2E8F0] bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-[#111827]">
                          {invoice.label}
                        </p>
                        <p className="mt-1 text-[12px] text-[#64748B]">
                          {invoice.invoiceNumber}
                        </p>
                      </div>
                      <StatusBadge status={invoice.status} isPaid={invoice.isPaid} />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                          Amount Due
                        </p>
                        <p className="mt-1 text-[18px] font-semibold text-[#111827]">
                          {invoice.amountDueDisplay}
                        </p>
                      </div>

                      {invoice.isPaid ? (
                        <p className="text-[12px] font-medium text-[#059669]">
                          Paid
                          {invoice.paymentMethod
                            ? ` (${invoice.paymentMethod === "online" ? "Online" : "Manual"})`
                            : ""}
                        </p>
                      ) : (
                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handlePay(invoice.type)}
                          className="h-[36px] rounded-[6px] bg-[#007F96] px-4 text-[12px] font-semibold text-white hover:bg-[#006B7D] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isProcessing ? "Redirecting..." : "Pay This Invoice"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <p className="mt-6 text-[11px] text-[#94A3B8]">
              Only one invoice can be paid at a time. The full due amount will be charged and cannot be modified.
            </p>
          </>
        ) : null}
      </section>
    </main>
  );
}
