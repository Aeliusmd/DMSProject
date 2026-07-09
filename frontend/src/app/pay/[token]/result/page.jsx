"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  fetchCheckoutResult,
  getReceiptDownloadUrl,
} from "@/lib/payments/publicPayApi";

const RESULT_TIMEOUT_MS = 30000;

export default function PublicPayResultPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = `${params?.token || ""}`;
  const sessionId = searchParams.get("session_id") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!token || !sessionId) {
      setError("Invalid payment result link.");
      setLoading(false);
      return;
    }

    let active = true;

    fetchCheckoutResult(token, sessionId)
      .then((data) => {
        if (!active) return;
        setResult(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "Unable to load payment result.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, sessionId]);

  useEffect(() => {
    if (loading || error || closed) return undefined;

    const interval = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(interval);
          setClosed(true);
          window.close();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [loading, error, closed]);

  const handleClose = () => {
    setClosed(true);
    window.close();
  };

  const success = result?.success;
  const receiptUrl = result?.receiptUrl;
  const downloadUrl = sessionId ? getReceiptDownloadUrl(sessionId, token) : "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-10">
      <section className="w-full max-w-[560px] rounded-[12px] border border-[#E2E8F0] bg-white p-8 shadow-sm">
        {loading ? (
          <p className="text-[13px] text-[#94A3B8]">Confirming your payment...</p>
        ) : error ? (
          <>
            <h1 className="text-[20px] font-semibold text-red-600">Payment Error</h1>
            <p className="mt-4 text-[13px] text-red-500">{error}</p>
          </>
        ) : success ? (
          <>
            <h1 className="text-[20px] font-semibold text-[#059669]">Thank You</h1>
            <p className="mt-2 text-[13px] text-[#334155]">
              Your payment was received successfully.
            </p>

            <div className="mt-6 rounded-[8px] border border-[#D1FAE5] bg-[#F0FDF4] p-4">
              <p className="text-[12px] text-[#334155]">
                <span className="font-semibold">Amount received:</span>{" "}
                {result.amountDisplay}
              </p>
              <p className="mt-2 text-[12px] text-[#334155]">
                <span className="font-semibold">Invoice:</span> {result.invoiceNumber}
              </p>
              <p className="mt-2 text-[12px] text-[#334155]">
                <span className="font-semibold">Order:</span> {result.orderNumber}
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[20px] font-semibold text-red-600">Payment Failed</h1>
            <p className="mt-2 text-[13px] text-[#334155]">
              We were unable to complete your payment.
            </p>
            <div className="mt-6 rounded-[8px] border border-[#FEE2E2] bg-[#FEF2F2] p-4">
              <p className="text-[12px] font-semibold text-[#991B1B]">Reason</p>
              <p className="mt-2 text-[12px] text-[#7F1D1D]">
                {result?.failureMessage || "Payment was not completed."}
              </p>
            </div>
          </>
        )}

        {!loading && !error && result ? (
          <div className="mt-6 flex flex-wrap gap-3">
            {success && downloadUrl ? (
              <a
                href={downloadUrl}
                className="inline-flex h-[36px] items-center rounded-[6px] bg-[#111827] px-4 text-[12px] font-semibold text-white hover:bg-[#1F2937]"
              >
                Download Payment Summary
              </a>
            ) : null}

            {success && receiptUrl ? (
              <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-[36px] items-center rounded-[6px] border border-[#E2E8F0] px-4 text-[12px] font-semibold text-[#334155] hover:bg-[#F8FAFC]"
              >
                View Stripe Receipt
              </a>
            ) : null}

            {success && result.hasAnotherUnpaidInvoice ? (
              <Link
                href={`/pay/${token}`}
                className="inline-flex h-[36px] items-center rounded-[6px] bg-[#007F96] px-4 text-[12px] font-semibold text-white hover:bg-[#006B7D]"
              >
                Pay Another Invoice
              </Link>
            ) : null}

            {!success ? (
              <Link
                href={`/pay/${token}`}
                className="inline-flex h-[36px] items-center rounded-[6px] bg-[#007F96] px-4 text-[12px] font-semibold text-white hover:bg-[#006B7D]"
              >
                Try Again
              </Link>
            ) : null}

            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-[36px] items-center rounded-[6px] border border-[#E2E8F0] px-4 text-[12px] font-semibold text-[#334155] hover:bg-[#F8FAFC]"
            >
              Close
            </button>
          </div>
        ) : null}

        {!loading && !closed ? (
          <p className="mt-6 text-[11px] text-[#94A3B8]">
            This page will close automatically in {secondsLeft} seconds.
          </p>
        ) : closed ? (
          <p className="mt-6 text-[11px] text-[#94A3B8]">
            You may close this window.
          </p>
        ) : null}
      </section>
    </main>
  );
}
