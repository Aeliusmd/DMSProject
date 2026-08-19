"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  exchangeImpersonation,
  saveImpersonationSession,
} from "@/lib/auth/authApi";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

function LoginAsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Opening this account...");
  const [error, setError] = useState("");

  useEffect(() => {
    const ended = searchParams.get("ended");
    const token = searchParams.get("token") || "";

    if (ended === "1") {
      setMessage("Support session ended. You can close this window.");
      return;
    }

    if (!token) {
      setError("This sign-in link is missing or invalid.");
      return;
    }

    let cancelled = false;

    async function completeSignIn() {
      try {
        const response = await exchangeImpersonation(token);
        const payload = response?.data || {};

        if (!payload.accessToken || !payload.user) {
          throw new Error("Unable to start this user session");
        }

        saveImpersonationSession(payload);

        if (!cancelled) {
          router.replace("/dashboard");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            getApiErrorMessage(
              err,
              "Unable to open this account. Please try again from the admin panel."
            )
          );
        }
      }
    }

    completeSignIn();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-[420px] rounded-[10px] border border-[#E2E8F0] bg-white p-6 text-center shadow-sm">
        <p className="text-[15px] font-semibold text-[#111827]">
          {error ? "Could not open account" : "Admin support session"}
        </p>
        <p className="mt-2 text-[13px] text-[#64748B]">{error || message}</p>
      </div>
    </div>
  );
}

export default function LoginAsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
          <p className="text-[13px] text-[#64748B]">Opening this account...</p>
        </div>
      }
    >
      <LoginAsContent />
    </Suspense>
  );
}
