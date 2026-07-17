"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CompanyPortalDashboardShell from "@/components/company-portal/CompanyPortalDashboardShell";
import CompanyPortalProfileCard from "@/components/company-portal/CompanyPortalProfileCard";
import { getCompanyCurrentUser } from "@/lib/company-portal/companyPortalAuthApi";
import {
  clearCompanyAuth,
  getCompanyAccessToken,
} from "@/lib/company-portal/companyPortalAuthStorage";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

export default function CompanyPortalProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const accessToken = getCompanyAccessToken();
      if (!accessToken) {
        router.replace("/company-portal/login");
        return;
      }

      try {
        const response = await getCompanyCurrentUser();
        if (!active) return;
        setUser(response?.data?.user || null);
      } catch (err) {
        if (!active) return;
        clearCompanyAuth();
        setError(getApiErrorMessage(err, "Unable to load profile"));
        router.replace("/company-portal/login");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [router]);

  const handleEdit = () => {
    setNotice("Profile editing will be available soon.");
    window.setTimeout(() => setNotice(""), 2800);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-[13px] text-[#64748B]">
        Loading profile...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-[13px] text-red-500">
        {error || "Unable to load profile"}
      </main>
    );
  }

  return (
    <CompanyPortalDashboardShell title="Profile">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
            {user.isAdmin === false ? "Employee profile" : "Company profile"}
          </h1>
          <p className="mt-1 text-[13px] text-[#64748B]">
            {user.isAdmin === false
              ? "View your employee account details and allocated wallet balance."
              : "View and manage your registered company account details."}
          </p>
        </div>
        {notice ? (
          <p className="rounded-[8px] border border-[#D0E8ED] bg-[#E6F7FA] px-3 py-2 text-[12px] font-medium text-[#0B7C8E]">
            {notice}
          </p>
        ) : null}
      </div>

      <div className="max-w-[640px]">
        <CompanyPortalProfileCard
          user={user}
          onEdit={handleEdit}
          isEmployee={user.isAdmin === false}
        />
      </div>
    </CompanyPortalDashboardShell>
  );
}
