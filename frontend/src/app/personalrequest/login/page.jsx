"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PersonalPortalAuthShell from "@/components/personal-request/PersonalPortalAuthShell";
import TwoFactorAuthModal from "@/components/auth/TwoFactorAuthModal";
import AuthInput from "@/components/ui/AuthInput";
import PrimaryButton from "@/components/ui/PrimaryButton";
import {
  loginPersonal,
  resendPersonalTwoFactor,
  savePersonalAuthSession,
  verifyPersonalTwoFactor,
} from "@/lib/personal-request/personalPortalAuthApi";
import { isPersonalAuthenticated } from "@/lib/personal-request/personalPortalAuthStorage";
import {
  applyApiFieldErrors,
  getApiErrorMessage,
  shouldShowSubmitError,
} from "@/lib/apiErrorUtils";

function validateEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Enter a valid email";
  return "";
}

export default function PersonalPortalLoginClient() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState({ email: false });
  const [apiFieldErrors, setApiFieldErrors] = useState({});
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTwoFactorOpen, setIsTwoFactorOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  useEffect(() => {
    if (isPersonalAuthenticated()) {
      router.replace("/personalrequest/dashboard");
    }
  }, [router]);

  const emailError = apiFieldErrors.email || validateEmail(email);
  const isFormValid = !emailError;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched({ email: true });
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setLoginError("");
    setApiFieldErrors({});

    try {
      const response = await loginPersonal({
        email: email.trim().toLowerCase(),
      });
      const payload = response?.data || {};
      setSessionToken(payload.sessionToken || "");
      setMaskedEmail(payload.email || email.trim());
      setIsTwoFactorOpen(true);
    } catch (error) {
      const { fieldErrors, message } = applyApiFieldErrors(error, {
        identifier: "email",
      });
      if (Object.keys(fieldErrors).length > 0) setApiFieldErrors(fieldErrors);
      if (shouldShowSubmitError(message, fieldErrors)) {
        setLoginError(
          message || getApiErrorMessage(error, "Unable to sign in. Please try again.")
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PersonalPortalAuthShell
        title="Personal sign in"
        subtitle="Personal Request Portal"
        footer={
          <p className="text-[12px] text-[#5B6B7C]">
            No password needed. Enter your email and we&apos;ll send a one-time
            verification code. A lightweight account is created automatically
            on first sign-in.
          </p>
        }
      >
        <p className="mb-4 rounded-[6px] border border-[#D0E8ED] bg-[#E6F7FA] px-3 py-2 text-[12px] text-[#0B7C8E]">
          Sign in with email + OTP only. Use the same email whenever you return
          to track your requests.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            <AuthInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, email: true }))}
              error={touched.email ? emailError : ""}
              placeholder="you@example.com"
            />
          </div>

          {loginError ? (
            <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
              {loginError}
            </p>
          ) : null}

          <div className="mt-6">
            <PrimaryButton type="submit" disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? "Sending code..." : "Continue with email"}
            </PrimaryButton>
          </div>
        </form>
      </PersonalPortalAuthShell>

      <TwoFactorAuthModal
        isOpen={isTwoFactorOpen}
        email={maskedEmail}
        sessionToken={sessionToken}
        subtitle="Personal Request Portal"
        verifyFn={verifyPersonalTwoFactor}
        resendFn={resendPersonalTwoFactor}
        saveSessionFn={savePersonalAuthSession}
        onClose={() => {
          setIsTwoFactorOpen(false);
          setSessionToken("");
          setMaskedEmail("");
        }}
        onSuccess={() => {
          setIsTwoFactorOpen(false);
          setSessionToken("");
          router.push("/personalrequest/dashboard");
        }}
      />
    </>
  );
}
