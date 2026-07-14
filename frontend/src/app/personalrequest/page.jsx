"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isPersonalAuthenticated } from "@/lib/personal-request/personalPortalAuthStorage";

/** Entry: send users to dashboard or login (company-portal style). */
export default function PersonalRequestEntryPage() {
  const router = useRouter();

  useEffect(() => {
    if (isPersonalAuthenticated()) {
      router.replace("/personalrequest/dashboard");
    } else {
      router.replace("/personalrequest/login");
    }
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-[13px] text-[#64748B]">
      Loading personal portal...
    </main>
  );
}
