"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PersonalPortalDashboardShell from "@/components/personal-request/PersonalPortalDashboardShell";
import { getPersonalCurrentUser } from "@/lib/personal-request/personalPortalAuthApi";
import {
  clearPersonalAuth,
  getPersonalAccessToken,
} from "@/lib/personal-request/personalPortalAuthStorage";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

export default function PersonalPortalProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!getPersonalAccessToken()) {
        router.replace("/personalrequest/login");
        return;
      }

      try {
        const response = await getPersonalCurrentUser();
        if (!active) return;
        setUser(response?.data?.user || null);
      } catch (err) {
        if (!active) return;
        clearPersonalAuth();
        setError(getApiErrorMessage(err, "Unable to load profile"));
        router.replace("/personalrequest/login");
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <PersonalPortalDashboardShell title="Profile">
      <h1 className="mb-5 text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
        Profile
      </h1>

      {error ? (
        <p className="mb-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {error}
        </p>
      ) : null}

      <section className="max-w-[560px] rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <dl className="space-y-3 text-[13px]">
          <div>
            <dt className="text-[#64748B]">Name</dt>
            <dd className="font-semibold text-[#111827]">
              {user?.displayName ||
                `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
                "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Email</dt>
            <dd className="font-semibold text-[#111827]">{user?.email || "—"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[12px] text-[#94A3B8]">
          Driver&apos;s license images uploaded with requests are stored for processing.
          Retention period to be confirmed by the team.
        </p>
      </section>
    </PersonalPortalDashboardShell>
  );
}
