"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Password registration is disabled. Accounts are created automatically
 * when a user signs in with email + OTP.
 */
export default function PersonalPortalRegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/personalrequest/login");
  }, [router]);

  return null;
}
