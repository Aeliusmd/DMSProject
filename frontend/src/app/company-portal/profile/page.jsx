"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CompanyPortalShell from "@/components/company-portal/CompanyPortalShell";
import PrimaryButton from "@/components/ui/PrimaryButton";
import {
  getCompanyCurrentUser,
  logoutCompany,
} from "@/lib/company-portal/companyPortalAuthApi";
import {
  clearCompanyAuth,
  getCompanyAccessToken,
} from "@/lib/company-portal/companyPortalAuthStorage";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

function ProfileRow({ label, value }) {
  return (
    <div className="border-b border-[#F1F5F9] py-3 last:border-b-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#94A3B8]">
        {label}
      </p>
      <p className="mt-1 text-[14px] font-medium text-[#111827]">
        {value || "—"}
      </p>
    </div>
  );
}

export default function CompanyPortalProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutCompany();
    } finally {
      router.replace("/company-portal/login");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[13px] text-[#64748B]">
        Loading profile...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[13px] text-red-500">
        {error || "Unable to load profile"}
      </main>
    );
  }

  const address = [
    user.addressLine1,
    user.addressLine2,
    [user.city, user.state, user.zip].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <CompanyPortalShell
      title="Company profile"
      subtitle="Company Portal"
      maxWidthClassName="max-w-[560px]"
    >
      <div className="mb-2">
        <ProfileRow label="Company name" value={user.companyName} />
        <ProfileRow label="Email" value={user.email} />
        <ProfileRow label="Phone" value={user.phone} />
        <ProfileRow label="Address" value={address} />
      </div>

      <div className="mt-5">
        <PrimaryButton
          type="button"
          disabled={isLoggingOut}
          onClick={handleLogout}
        >
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </PrimaryButton>
      </div>
    </CompanyPortalShell>
  );
}
