"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PersonalPortalDashboardShell from "@/components/personal-request/PersonalPortalDashboardShell";
import PersonalRecordsDownloadButton from "@/components/personal-request/PersonalRecordsDownloadButton";
import PersonalResearchFeeBanner from "@/components/personal-request/PersonalResearchFeeBanner";
import CompanyPortalStatCard from "@/components/company-portal/CompanyPortalStatCard";
import {
  fulfillPersonalResearchFeeCheckout,
  getPersonalDashboard,
  createPersonalResearchFeeCheckout,
} from "@/lib/personal-request/personalPortalAuthApi";
import {
  clearPersonalAuth,
  getPersonalAccessToken,
  getStoredPersonalUser,
} from "@/lib/personal-request/personalPortalAuthStorage";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

const EMPTY_STATS = {
  totalOrders: 0,
  inProcess: 0,
  invoice: 0,
  paid: 0,
  released: 0,
};

const STATUS_STYLES = {
  in_process: "bg-[#E6F7FA] text-[#007F96]",
  invoice: "bg-[#FEF3C7] text-[#B45309]",
  paid: "bg-[#DBEAFE] text-[#1D4ED8]",
  released: "bg-[#DCFCE7] text-[#15803D]",
};

export default function PersonalPortalDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [recentRequests, setRecentRequests] = useState([]);
  const [lookupDays, setLookupDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bannerMessage, setBannerMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!getPersonalAccessToken()) {
        router.replace("/personalrequest/login");
        return;
      }

      setUser(getStoredPersonalUser());

      const sessionId = searchParams.get("session_id");
      const researchFeePaid = searchParams.get("researchFeePaid") === "1";
      const payResearchFeeId = searchParams.get("payResearchFee");

      try {
        if (sessionId && researchFeePaid) {
          await fulfillPersonalResearchFeeCheckout(sessionId);
          if (active) {
            setBannerMessage("Facility verification fee paid successfully.");
          }
        }

        if (payResearchFeeId) {
          const checkout = await createPersonalResearchFeeCheckout(
            Number(payResearchFeeId)
          );
          const checkoutUrl =
            checkout?.data?.checkoutUrl || checkout?.checkoutUrl;
          if (checkoutUrl) {
            window.location.href = checkoutUrl;
            return;
          }
        }

        const dashRes = await getPersonalDashboard();
        if (!active) return;
        setStats(dashRes?.data?.stats || EMPTY_STATS);
        setRecentRequests(dashRes?.data?.recentRequests || []);
        setLookupDays(dashRes?.data?.lookupDays || 7);
      } catch (err) {
        if (!active) return;
        if (err?.status === 401) {
          clearPersonalAuth();
          setError(getApiErrorMessage(err, "Unable to load dashboard"));
          router.replace("/personalrequest/login");
          return;
        }
        setError(getApiErrorMessage(err, "Unable to load dashboard"));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [router, searchParams]);

  const cards = useMemo(
    () => [
      {
        label: "Total requests",
        value: stats.totalOrders,
        hint: "Paid and placed requests",
        icon: <OrdersIcon />,
        iconBg: "#E6F7FA",
        iconColor: "#0097B2",
      },
      {
        label: "In Process",
        value: stats.inProcess,
        hint: "Being verified and processed",
        icon: <PendingIcon />,
        iconBg: "#FFF7ED",
        iconColor: "#EA580C",
      },
      {
        label: "Invoice",
        value: stats.invoice,
        hint: "Invoice stage",
        icon: <InvoiceIcon />,
        iconBg: "#FEF3C7",
        iconColor: "#D97706",
      },
      {
        label: "Paid",
        value: stats.paid,
        hint: "Facility payment completed",
        icon: <PaidIcon />,
        iconBg: "#EFF6FF",
        iconColor: "#2563EB",
      },
      {
        label: "Released",
        value: stats.released,
        hint: "Documents ready to download",
        icon: <ReleasedIcon />,
        iconBg: "#ECFDF5",
        iconColor: "#059669",
      },
    ],
    [stats]
  );

  const displayName =
    user?.displayName ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    "there";

  return (
    <PersonalPortalDashboardShell title="Dashboard">
      {error ? (
        <p className="mb-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {error}
        </p>
      ) : null}

      {bannerMessage ? (
        <p className="mb-4 rounded-[6px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
          {bannerMessage}
        </p>
      ) : null}

      <PersonalResearchFeeBanner requests={recentRequests} />

      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
          Welcome, {displayName}
        </h1>
        <p className="mt-1 text-[13px] text-[#64748B]">
          Submit personal records requests, pay the $35 processing fee, and track every
          request under your account.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <CompanyPortalStatCard
            key={card.label}
            label={card.label}
            value={loading ? "…" : card.value}
            hint={card.hint}
            icon={card.icon}
            iconBg={card.iconBg}
            iconColor={card.iconColor}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/personalrequest/new"
          className="rounded-[10px] border border-[#D0E8ED] bg-[#E6F7FA] px-5 py-4 text-[13px] font-semibold text-[#0B7C8E] hover:bg-[#D7F2F7]"
        >
          + New records request
        </Link>
        <Link
          href="/personalrequest/requests"
          className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-4 text-[13px] font-semibold text-[#334155] hover:bg-[#F8FAFC]"
        >
          View all my requests
        </Link>
        <Link
          href="/personalrequest/status"
          className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-4 text-[13px] font-semibold text-[#334155] hover:bg-[#F8FAFC]"
        >
          Check status (Order # + DOB)
        </Link>
      </div>

      <section className="mt-5 rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#F1F5F9] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827]">Recent requests</h2>
            <p className="mt-1 text-[12px] text-[#64748B]">
              Paid requests from the last {lookupDays} days linked to your email
              account
            </p>
          </div>
          <Link
            href="/personalrequest/requests"
            className="text-[12px] font-medium text-[#0097B2] hover:underline"
          >
            View all
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
              <tr>
                <th className="px-5 py-3">Confirmation</th>
                <th className="px-5 py-3">Facility</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[#94A3B8]">
                    Loading requests...
                  </td>
                </tr>
              ) : recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[#94A3B8]">
                    No requests in the last {lookupDays} days. Start a new personal
                    records request to get started.
                  </td>
                </tr>
              ) : (
                recentRequests.map((request) => (
                  <tr key={request.id || request.confirmationReference} className="border-t border-[#F1F5F9]">
                    <td className="px-5 py-3 font-semibold text-[#0097B2]">
                      {request.confirmationReference || "—"}
                    </td>
                    <td className="px-5 py-3 text-[#334155]">
                      {request.treatingFacilityName || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          STATUS_STYLES[request.status] || "bg-[#F1F5F9] text-[#64748B]"
                        }`}
                      >
                        {request.statusLabel || request.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {request.receiptUrl ? (
                          <a
                            href={request.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-[#0097B2] hover:underline"
                          >
                            Receipt
                          </a>
                        ) : null}
                        {request.canDownload &&
                        (request.downloadToken || request.downloadUrl) ? (
                          <PersonalRecordsDownloadButton
                            downloadToken={request.downloadToken}
                            downloadUrl={request.downloadUrl}
                            label="Download"
                            className="font-semibold text-[#16A34A] hover:underline"
                          />
                        ) : (
                          <Link
                            href={`/personalrequest/status?ref=${encodeURIComponent(
                              request.confirmationReference || ""
                            )}`}
                            className="font-semibold text-[#0097B2] hover:underline"
                          >
                            View
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PersonalPortalDashboardShell>
  );
}

function OrdersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7h8M8 12h8M8 17h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v4l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h10v18l-2-1.2L13 21l-2-1.2L9 21l-2-1.2V3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 8h6M9 12h6M9 16h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PaidIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ReleasedIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.5 12.5 11 15l4.5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
