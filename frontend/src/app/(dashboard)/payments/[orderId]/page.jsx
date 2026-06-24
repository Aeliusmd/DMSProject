"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import OrderInvoicesSection from "@/components/payments/OrderInvoicesSection";
import OrderPaymentsSection from "@/components/payments/OrderPaymentsSection";
import OrderPaymentSummary from "@/components/payments/OrderPaymentSummary";
import { getOrderPaymentDetail } from "@/lib/payments/paymentApi";

export default function OrderPaymentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = String(params.orderId || "");
  const channel = searchParams.get("channel") === "online" ? "online" : "manual";
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) return undefined;

    let active = true;
    setLoading(true);
    setError("");

    getOrderPaymentDetail(orderId, { channel })
      .then((data) => {
        if (!active) return;
        if (!data) {
          setDetail(null);
          setError("Order payment details were not found.");
          return;
        }
        setDetail(data);
      })
      .catch(() => {
        if (active) {
          setDetail(null);
          setError("Failed to load order payment details.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId, channel]);

  const backHref = `/payments${channel ? `?channel=${channel}` : ""}`;

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href={backHref}
              className="mb-2 inline-flex items-center gap-2 text-[12px] font-semibold text-[#007F96] hover:underline"
            >
              <ArrowLeftIcon />
              Back to Payments
            </Link>

            <h1 className="text-[18px] font-semibold text-[#111827]">
              Order Payment Details
            </h1>

            {detail ? (
              <p className="mt-1 text-[12px] text-[#64748B]">
                Order #{detail.orderNo} · {detail.applicant} · {detail.company}
              </p>
            ) : null}
          </div>

          {detail ? (
            <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-[12px] text-[#334155]">
              <p>
                <span className="font-semibold text-[#64748B]">Case #:</span>{" "}
                {detail.caseNo}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-[#64748B]">Viewing:</span>{" "}
                {channel === "online" ? "Online Payments" : "Manual Payments"}
              </p>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center rounded-[10px] border border-[#E2E8F0] bg-white py-16">
            <p className="text-[13px] text-[#94A3B8]">Loading payment details...</p>
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center rounded-[10px] border border-[#FEE2E2] bg-[#FEF2F2] py-16">
            <p className="text-[13px] font-medium text-red-500">{error}</p>
          </div>
        ) : detail ? (
          <>
            <OrderPaymentSummary totals={detail.totals} />
            <OrderInvoicesSection invoices={detail.invoices} />
            <OrderPaymentsSection
              manualPayments={detail.manualPayments}
              onlinePayments={detail.onlinePayments}
            />
          </>
        ) : null}
      </div>
    </DashboardShell>
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
