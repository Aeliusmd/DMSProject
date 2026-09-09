"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";
import { getTopProviders } from "@/lib/dashboard/dashboardApi";

const VISIBLE_COUNT = 5;
const FETCH_LIMIT = 20;
/**
 * Viewport for exactly 5 provider rows:
 * row ~40px + gap 16px between rows → 5*40 + 4*16 = 264px
 */
const LIST_VIEWPORT_CLASS = "h-[264px]";

export default function DashboardTopProviders() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getTopProviders(FETCH_LIMIT)
      .then((data) => {
        if (active) setProviders(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active) {
          setProviders([]);
          setError(getApiErrorMessage(err, "Failed to load top providers"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const canScroll = !loading && providers.length > VISIBLE_COUNT;

  return (
    <section className="flex shrink-0 flex-col overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
      <div className="mb-4 flex shrink-0 items-center justify-between">
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

      {error ? (
        <p className="mb-3 shrink-0 text-[12px] font-medium text-red-500">
          {error}
        </p>
      ) : null}

      <div
        className={`min-h-0 space-y-4 overflow-x-hidden ${LIST_VIEWPORT_CLASS} ${
          canScroll ? "overflow-y-auto" : "overflow-y-hidden"
        }`}
      >
        {loading
          ? Array.from({ length: VISIBLE_COUNT }).map((_, index) => (
              <ProviderRowSkeleton key={`loading-${index}`} />
            ))
          : null}

        {!loading &&
          providers.map((provider) => (
            <div
              key={provider.name}
              className="flex h-10 items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <h3 className="truncate text-[12px] font-semibold leading-4 text-[#334155]">
                  {provider.name}
                </h3>
                <p className="mt-1 text-[10px] leading-3 text-[#94A3B8]">
                  {provider.casesLabel}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[12px] font-semibold leading-4 text-[#334155]">
                  {provider.invoiced}
                </p>
                <p className="mt-1 text-[10px] font-semibold leading-3 text-[#059669]">
                  {provider.paid}
                </p>
              </div>
            </div>
          ))}

        {!loading && !error && providers.length === 0 ? (
          <p className="text-center text-[12px] text-[#94A3B8]">
            No provider data found.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ProviderRowSkeleton() {
  return (
    <div className="flex h-10 items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="h-3 w-32 animate-pulse rounded bg-[#E2E8F0]" />
        <div className="mt-2 h-2 w-16 animate-pulse rounded bg-[#F1F5F9]" />
      </div>
      <div className="shrink-0 text-right">
        <div className="ml-auto h-3 w-20 animate-pulse rounded bg-[#E2E8F0]" />
        <div className="ml-auto mt-2 h-2 w-16 animate-pulse rounded bg-[#F1F5F9]" />
      </div>
    </div>
  );
}
