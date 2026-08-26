"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ensureStaffClientSession,
  getCurrentUser,
  refreshAccessToken,
  startAuthAutoRefresh,
  stopAuthAutoRefresh,
} from "@/lib/auth/authApi";
import { clearAuth, isImpersonating } from "@/lib/auth/authStorage";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      const wasImpersonating = isImpersonating();

      try {
        // Tab close clears sessionStorage; cookies alone must not keep the user in.
        const hasClientSession = await ensureStaffClientSession();
        if (!hasClientSession) {
          if (isMounted) {
            router.replace(wasImpersonating ? "/login-as?ended=1" : "/login");
          }
          return;
        }

        await getCurrentUser();

        if (isMounted) {
          setIsAuthorized(true);
          startAuthAutoRefresh();
        }
      } catch {
        try {
          await refreshAccessToken();
          await getCurrentUser();

          if (isMounted) {
            setIsAuthorized(true);
            startAuthAutoRefresh();
          }
        } catch {
          clearAuth();
          router.replace(wasImpersonating ? "/login-as?ended=1" : "/login");
        }
      }
    }

    verifySession();

    return () => {
      isMounted = false;
      stopAuthAutoRefresh();
    };
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <p className="text-[13px] text-[#64748B]">Checking session...</p>
      </div>
    );
  }

  return (
    <RoleRouteGuard>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
            <p className="text-[13px] text-[#64748B]">Loading...</p>
          </div>
        }
      >
        {children}
      </Suspense>
    </RoleRouteGuard>
  );
}
