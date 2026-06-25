"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTopProviders } from "@/lib/dashboard/dashboardApi";

export default function DashboardTopProviders() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getTopProviders(5)
      .then((data) => {
        if (active) setProviders(data);
      })
      .catch((err) => {
        if (active) {
          setProviders([]);
          setError(err.message || "Failed to load top providers");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-[#111827]">
          Top Providers
        </h2>

        <Link
          href="/reports/activity-report"
          className="text-[11px] font-semibold text-[#0097B2] hover:underline"
        >
          Full Report
        </Link>
      </div>

      {error && (
        <p className="mb-3 text-[12px] font-medium text-red-500">{error}</p>
      )}

      <div className="space-y-4">
        {loading &&
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`loading-${index}`}
              className="flex items-start justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="h-3 w-32 animate-pulse rounded bg-[#E2E8F0]" />
                <div className="mt-2 h-2 w-16 animate-pulse rounded bg-[#F1F5F9]" />
              </div>
              <div className="shrink-0 text-right">
                <div className="h-3 w-20 animate-pulse rounded bg-[#E2E8F0]" />
                <div className="mt-2 h-2 w-16 animate-pulse rounded bg-[#F1F5F9]" />
              </div>
            </div>
          ))}

        {!loading &&
          providers.map((provider) => (
            <div
              key={provider.name}
              className="flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <h3 className="truncate text-[12px] font-semibold text-[#334155]">
                  {provider.name}
                </h3>
                <p className="mt-1 text-[10px] text-[#94A3B8]">
                  {provider.casesLabel}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[12px] font-semibold text-[#334155]">
                  {provider.invoiced}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-[#059669]">
                  {provider.paid}
                </p>
              </div>
            </div>
          ))}

        {!loading && !error && providers.length === 0 && (
          <p className="text-center text-[12px] text-[#94A3B8]">
            No provider data found.
          </p>
        )}
      </div>
    </section>
  );
}
