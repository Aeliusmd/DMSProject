"use client";

import Image from "next/image";

export default function CompanyPortalDashboardHeader({
  companyName,
  onLogout,
  isLoggingOut,
}) {
  return (
    <header className="border-b border-[#E2E8F0] bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/images/logo.png"
            alt="DMS Logo"
            width={48}
            height={32}
            priority
            style={{ height: "auto" }}
            className="w-[42px]"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#0F6B7A] uppercase">
              Company Portal
            </p>
            <p className="truncate text-[14px] font-semibold text-[#111827]">
              {companyName || "Company account"}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isLoggingOut}
          onClick={onLogout}
          className="rounded-[6px] border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-medium text-[#475569] transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </header>
  );
}
