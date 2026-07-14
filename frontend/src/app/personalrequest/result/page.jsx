"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PersonalRequestShell from "@/components/personal-request/PersonalRequestShell";
import RequestStepper from "@/components/personal-request/RequestStepper";
import { fetchPersonalRequestResult } from "@/lib/personal-request/personalRequestApi";
import { clearPersonalRequestDraft } from "@/lib/personal-request/personalRequestDraft";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

export default function PersonalRequestResultPage() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request_id");
  const sessionId = searchParams.get("session_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!requestId || !sessionId) {
      setError("Invalid payment return link.");
      setLoading(false);
      return;
    }

    let active = true;

    fetchPersonalRequestResult(requestId, sessionId)
      .then((data) => {
        if (active) {
          clearPersonalRequestDraft();
          setResult(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(getApiErrorMessage(err, "Unable to confirm your payment."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [requestId, sessionId]);

  return (
    <PersonalRequestShell>
      <RequestStepper currentStep={loading || error ? 2 : 3} />

      <section className="rounded-[12px] border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8">
        {loading ? (
          <p className="py-10 text-center text-[13px] text-[#64748B]">
            Confirming your payment...
          </p>
        ) : null}

        {!loading && error ? (
          <div className="space-y-5 text-center">
            <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
              {error}
            </div>
            <Link
              href="/personalrequest"
              className="inline-flex h-[46px] w-full items-center justify-center rounded-[8px] bg-[#0097B2] text-[14px] font-semibold text-white hover:bg-[#0086A0]"
            >
              Return to request form
            </Link>
          </div>
        ) : null}

        {!loading && !error && result ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#DCFCE7] text-[#16A34A]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 13.5 8.2 16.7 14 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 13.5 13.2 16.7 19 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111827]">
                Request Submitted!
              </h1>
              <p className="mt-2 text-[14px] text-[#64748B]">
                Your records request has been submitted successfully!
              </p>
            </div>

            <div className="rounded-[10px] bg-[#F8FAFC] px-4 py-5">
              <p className="text-[12px] font-medium text-[#64748B]">Your Order Number</p>
              <p className="mt-1 text-[28px] font-bold tracking-[-0.02em] text-[#0097B2]">
                {result.confirmationReference}
              </p>
              <p className="mt-1 text-[11px] text-[#94A3B8]">Keep this number for your records</p>
            </div>

            <div className="rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-4 text-left">
              <p className="text-[13px] font-semibold text-[#B45309]">What happens next?</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[12px] text-[#92400E]">
                <li>We verify your identity and request details</li>
                <li>Records are retrieved from the treating facility</li>
                <li>
                  Come back anytime with your order number to check status (available for about 7
                  days)
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                href="/personalrequest/dashboard"
                className="inline-flex h-[46px] w-full items-center justify-center rounded-[8px] bg-[#0097B2] text-[14px] font-semibold text-white hover:bg-[#0086A0]"
              >
                Go to My Dashboard
              </Link>
              <Link
                href={`/personalrequest/status?ref=${encodeURIComponent(result.confirmationReference || "")}`}
                className="inline-flex h-[46px] w-full items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-white text-[14px] font-semibold text-[#334155] hover:bg-[#F8FAFC]"
              >
                Check Request Status
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </PersonalRequestShell>
  );
}
