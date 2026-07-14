"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CompanyPortalDashboardShell from "@/components/company-portal/CompanyPortalDashboardShell";
import { isCompanyAuthenticated } from "@/lib/company-portal/companyPortalAuthStorage";
import { useEffect } from "react";

export default function CompanyPortalTrackEntryPage() {
  const router = useRouter();
  const [trackInput, setTrackInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isCompanyAuthenticated()) {
      router.replace("/company-portal/login");
    }
  }, [router]);

  const handleTrack = (event) => {
    event.preventDefault();
    const value = trackInput.trim().toUpperCase();
    if (!value) {
      setError("Enter your order number to continue.");
      return;
    }
    router.push(`/company-portal/orders/track/${encodeURIComponent(value)}`);
  };

  return (
    <CompanyPortalDashboardShell title="Track Order">
      <div className="mx-auto max-w-[560px]">
        <h1 className="text-[22px] font-semibold text-[#111827]">
          Track your order
        </h1>
        <p className="mt-1 text-[13px] text-[#64748B]">
          Enter the order number from your payment confirmation to view status
          and details.
        </p>

        <form
          onSubmit={handleTrack}
          className="mt-6 rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm"
        >
          <label className="block text-[12px] font-medium text-[#334155]">
            Order number
          </label>
          <input
            type="text"
            value={trackInput}
            onChange={(event) => {
              setTrackInput(event.target.value);
              if (error) setError("");
            }}
            placeholder="ORD-123456"
            className="mt-2 h-11 w-full rounded-[8px] border border-[#E2E8F0] px-3 text-[13px] outline-none focus:border-[#0097B2]"
          />
          {error ? (
            <p className="mt-2 text-[12px] text-red-600">{error}</p>
          ) : null}
          <button
            type="submit"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[8px] bg-[#0097B2] text-[13px] font-semibold text-white hover:bg-[#0086A0]"
          >
            Track order
          </button>
        </form>
      </div>
    </CompanyPortalDashboardShell>
  );
}
