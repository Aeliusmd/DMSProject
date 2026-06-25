"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/auth/authStorage";
import {
  canAccessRoute,
  getRestrictedRedirectPath,
} from "@/lib/auth/roles";

export default function RoleRouteGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getStoredUser();
  const allowed = canAccessRoute(user, pathname);

  useEffect(() => {
    if (!allowed) {
      router.replace(getRestrictedRedirectPath(user));
    }
  }, [allowed, router, user]);

  if (!allowed) {
    return (
      <div className="flex min-h-[calc(100vh-92px)] items-center justify-center">
        <p className="text-[13px] text-[#64748B]">Redirecting...</p>
      </div>
    );
  }

  return children;
}
