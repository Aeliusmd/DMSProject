"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PersonalPortalDashboardShell from "@/components/personal-request/PersonalPortalDashboardShell";
import { lookupPersonalRequestStatus } from "@/lib/personal-request/personalRequestApi";
import { validateStatusLookupForm } from "@/lib/validations/personalRequestValidation";
import {
  clearPersonalAuth,
  getPersonalAccessToken,
} from "@/lib/personal-request/personalPortalAuthStorage";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

function StatusBadge({ status, label }) {
  const styles = {
    pending_payment: "bg-[#FEE2E2] text-[#B91C1C]",
    in_process: "bg-[#DBEAFE] text-[#1D4ED8]",
    invoice: "bg-[#FEF3C7] text-[#B45309]",
    paid: "bg-[#ECFDF5] text-[#047857]",
    released: "bg-[#DCFCE7] text-[#15803D]",
  };

  return (
    <span
      className={`inline-flex h-[28px] items-center rounded-full px-3 text-[12px] font-semibold ${
        styles[status] || "bg-[#F1F5F9] text-[#64748B]"
      }`}
    >
      {label || status}
    </span>
  );
}

export default function PersonalRequestStatusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authReady, setAuthReady] = useState(false);
  const [confirmationReference, setConfirmationReference] = useState(
    () => searchParams.get("ref") || ""
  );
  const [driverLicenseNumber, setDriverLicenseNumber] = useState("");
  const [errors, setErrors] = useState({});
  const [bannerError, setBannerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!getPersonalAccessToken()) {
      clearPersonalAuth();
      router.replace("/personalrequest/login");
      return;
    }
    setAuthReady(true);
  }, [router]);

  const handleLookup = async (e) => {
    e.preventDefault();
    setBannerError("");
    setResult(null);

    const formData = { confirmationReference, driverLicenseNumber };
    const nextErrors = validateStatusLookupForm(formData);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const data = await lookupPersonalRequestStatus({
        confirmationReference: confirmationReference.trim() || undefined,
        driverLicenseNumber: driverLicenseNumber.trim() || undefined,
      });
      setResult(data);
    } catch (err) {
      setBannerError(
        getApiErrorMessage(err, "Unable to find your request. Check your details and try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  if (!authReady) {
    return null;
  }

  return (
    <PersonalPortalDashboardShell title="Check Status">
      <section className="mx-auto max-w-[640px] rounded-[12px] border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#E6F7FA] text-[#0097B2]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
              <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
            Check Request Status
          </h1>
          <p className="mt-2 text-[13px] text-[#64748B]">
            Enter your confirmation number or driver&apos;s license number to see status and
            download records when ready.
          </p>
        </div>

        <form onSubmit={handleLookup} className="space-y-4">
          {bannerError ? (
            <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
              {bannerError}
            </div>
          ) : null}

          {errors.lookup ? (
            <p className="text-[11px] font-medium text-red-500">{errors.lookup}</p>
          ) : null}

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#334155]">
              Confirmation / Order Number
            </label>
            <input
              value={confirmationReference}
              onChange={(e) => setConfirmationReference(e.target.value)}
              placeholder="e.g. PR-20260714-ABC123"
              className="h-[42px] w-full rounded-[8px] border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
            />
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[#94A3B8]">
            <span className="h-px flex-1 bg-[#E2E8F0]" />
            OR
            <span className="h-px flex-1 bg-[#E2E8F0]" />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#334155]">
              Driver&apos;s License Number
            </label>
            <input
              value={driverLicenseNumber}
              onChange={(e) => setDriverLicenseNumber(e.target.value)}
              placeholder="License number used on your request"
              className={`h-[42px] w-full rounded-[8px] border bg-white px-3 text-[13px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
                errors.driverLicenseNumber
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                  : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
              }`}
            />
            {errors.driverLicenseNumber ? (
              <p className="mt-1 text-[11px] font-medium text-red-500">
                {errors.driverLicenseNumber}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-[46px] w-full items-center justify-center rounded-[8px] bg-[#0097B2] text-[14px] font-semibold text-white transition hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
          >
            {loading ? "Checking..." : "Check Status"}
          </button>
        </form>

        {result ? (
          <div className="mt-6 space-y-4 rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
                  Order Number
                </p>
                <p className="mt-0.5 text-[16px] font-semibold text-[#111827]">
                  {result.confirmationReference || "—"}
                </p>
              </div>
              <StatusBadge status={result.status} label={result.statusLabel} />
            </div>

            <dl className="grid gap-2.5 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-[#64748B]">Name</dt>
                <dd className="font-medium text-[#111827]">
                  {[result.firstName, result.lastName].filter(Boolean).join(" ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Email</dt>
                <dd className="font-medium text-[#111827]">{result.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Facility</dt>
                <dd className="font-medium text-[#111827]">
                  {result.treatingFacilityName || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Date Range</dt>
                <dd className="font-medium text-[#111827]">
                  {result.recordsDateBegin || "—"} – {result.recordsDateEnd || "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[#64748B]">Record Types</dt>
                <dd className="font-medium text-[#111827]">
                  {(result.recordTypes || []).join(", ") || "—"}
                </dd>
              </div>
            </dl>

            {result.canDownload && result.downloadUrl ? (
              <a
                href={result.downloadUrl}
                className="flex h-[46px] w-full items-center justify-center rounded-[8px] bg-[#16A34A] text-[14px] font-semibold text-white hover:bg-[#15803D]"
              >
                Download Records
              </a>
            ) : (
              <p className="rounded-[8px] border border-[#E2E8F0] bg-white px-3 py-2.5 text-[12px] text-[#64748B]">
                {result.status === "released"
                  ? "Records are marked released, but a download link could not be created right now."
                  : "Your request is still in process. Check back later — status lookup is available for about 7 days after payment."}
              </p>
            )}
          </div>
        ) : null}

        <p className="mt-6 text-[12px] text-[#64748B]">
          Need a new request?{" "}
          <Link
            href="/personalrequest/new"
            className="font-semibold text-[#0097B2] hover:underline"
          >
            Submit one here
          </Link>
        </p>
      </section>
    </PersonalPortalDashboardShell>
  );
}
