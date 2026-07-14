"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PersonalPortalDashboardShell from "@/components/personal-request/PersonalPortalDashboardShell";
import { listPersonalRequests } from "@/lib/personal-request/personalPortalAuthApi";
import {
  clearPersonalAuth,
  getPersonalAccessToken,
} from "@/lib/personal-request/personalPortalAuthStorage";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

const STATUS_STYLES = {
  in_process: "bg-[#E6F7FA] text-[#007F96]",
  invoice: "bg-[#FEF3C7] text-[#B45309]",
  paid: "bg-[#DBEAFE] text-[#1D4ED8]",
  released: "bg-[#DCFCE7] text-[#15803D]",
};

export default function PersonalRequestsListPage() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
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
        const response = await listPersonalRequests();
        if (!active) return;
        setRequests(response?.data?.requests || []);
      } catch (err) {
        if (!active) return;
        clearPersonalAuth();
        setError(getApiErrorMessage(err, "Unable to load requests"));
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

  return (
    <PersonalPortalDashboardShell title="My Requests">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
            My Requests
          </h1>
          <p className="mt-1 text-[13px] text-[#64748B]">
            Every paid request under your registered email. After the $35 prepayment: In Process →
            Invoice (additional charges in DMS) → Paid → Released.
          </p>
        </div>
        <Link
          href="/personalrequest/new"
          className="inline-flex h-10 items-center rounded-[8px] bg-[#0097B2] px-4 text-[13px] font-semibold text-white hover:bg-[#0086A0]"
        >
          + New request
        </Link>
      </div>

      {error ? (
        <p className="mb-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {error}
        </p>
      ) : null}

      <section className="rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
              <tr>
                <th className="px-5 py-3">Confirmation</th>
                <th className="px-5 py-3">Facility</th>
                <th className="px-5 py-3">Date range</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[#94A3B8]">
                    Loading...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[#94A3B8]">
                    No paid requests yet.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr
                    key={request.id || request.confirmationReference}
                    className="border-t border-[#F1F5F9]"
                  >
                    <td className="px-5 py-3 font-semibold text-[#0097B2]">
                      {request.confirmationReference || "—"}
                    </td>
                    <td className="px-5 py-3 text-[#334155]">
                      {request.treatingFacilityName || "—"}
                    </td>
                    <td className="px-5 py-3 text-[#334155]">
                      {request.recordsDateBegin || "—"} – {request.recordsDateEnd || "—"}
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
