"use client";

import { Suspense } from "react";
import CompanyPortalLoginPage from "./CompanyPortalLoginClient";

export default function CompanyPortalLoginRoute() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-[13px] text-[#64748B]">
          Loading...
        </main>
      }
    >
      <CompanyPortalLoginPage />
    </Suspense>
  );
}
