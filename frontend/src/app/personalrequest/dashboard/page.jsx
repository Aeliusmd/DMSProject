"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PersonalPortalDashboardShell from "@/components/personal-request/PersonalPortalDashboardShell";
import CompanyPortalStatCard from "@/components/company-portal/CompanyPortalStatCard";
import {
  getPersonalCurrentUser,
  getPersonalDashboard,
} from "@/lib/personal-request/personalPortalAuthApi";
import {
  clearPersonalAuth,
  getPersonalAccessToken,
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
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!getPersonalAccessToken()) {
        router.replace("/personalrequest/login");
        return;
      }

      try {
        const [userRes, dashRes] = await Promise.all([
          getPersonalCurrentUser(),
          getPersonalDashboard(),
        ]);
        if (!active) return;
        setUser(userRes?.data?.user || null);
        setStats(dashRes?.data?.stats || EMPTY_STATS);
        setRecentRequests(dashRes?.data?.recentRequests || []);
      } catch (err) {
        if (!active) return;
        clearPersonalAuth();
        setError(getApiErrorMessage(err, "Unable to load dashboard"));
        router.replace("/personalrequest/login");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [router]);

  const cards = useMemo(
    () => [
      {
        label: "Total requests",
        value: stats.totalOrders,
        hint: "Paid personal requests",
        iconBg: "#E6F7FA",
        iconColor: "#0097B2",
      },
      {
        label: "In Process",
        value: stats.inProcess,
        hint: "Received; being worked on",
        iconBg: "#FFF7ED",
        iconColor: "#EA580C",
      },
      {
        label: "Invoice",
        value: stats.invoice,
        hint: "Additional charges beyond $35",
        iconBg: "#FEF3C7",
        iconColor: "#B45309",
      },
      {
        label: "Paid",
        value: stats.paid,
        hint: "Invoice paid; preparing records",
        iconBg: "#DBEAFE",
        iconColor: "#1D4ED8",
      },
      {
        label: "Released",
        value: stats.released,
        hint: "Records ready",
        iconBg: "#DCFCE7",
        iconColor: "#15803D",
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

      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
          Welcome, {displayName}
        </h1>
        <p className="mt-1 text-[13px] text-[#64748B]">
          Submit personal records requests, pay the $35 processing fee, and track every
          request under your account.
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <CompanyPortalStatCard
            key={card.label}
            label={card.label}
            value={loading ? "…" : card.value}
            hint={card.hint}
            iconBg={card.iconBg}
            iconColor={card.iconColor}
          />
        ))}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          Check status by confirmation #
        </Link>
      </div>

      <section className="rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#F1F5F9] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827]">Recent requests</h2>
            <p className="mt-1 text-[12px] text-[#64748B]">
              All paid requests linked to your email account
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
                    No requests yet. Start a new personal records request to get started.
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
                      {request.canDownload && request.downloadUrl ? (
                        <a
                          href={request.downloadUrl}
                          className="font-semibold text-[#16A34A] hover:underline"
                        >
                          Download
                        </a>
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
