"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentUser,
  startAuthAutoRefresh,
  stopAuthAutoRefresh,
} from "@/lib/auth/authApi";
import { clearAuth } from "@/lib/auth/authStorage";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      try {
        await getCurrentUser();

        if (isMounted) {
          setIsAuthorized(true);
          startAuthAutoRefresh();
        }
      } catch {
        clearAuth();
        router.replace("/login");
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

  return <RoleRouteGuard>{children}</RoleRouteGuard>;
}
