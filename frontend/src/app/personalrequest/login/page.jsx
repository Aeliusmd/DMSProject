"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

function validatePassword(value) {
  if (!value) return "Password is required";
  return "";
}

export default function PersonalPortalLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
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
  const passwordError = apiFieldErrors.password || validatePassword(password);
  const isFormValid = !emailError && !passwordError;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setLoginError("");
    setApiFieldErrors({});

    try {
      const response = await loginPersonal({
        email: email.trim().toLowerCase(),
        password,
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
          <p>
            Need an account?{" "}
            <Link
              href="/personalrequest/register"
              className="font-medium text-[#0097B2] hover:underline"
            >
              Register with email
            </Link>
          </p>
        }
      >
        {registered ? (
          <p className="mb-4 rounded-[6px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">
            Registration successful. Please sign in to continue.
          </p>
        ) : null}

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
            <AuthInput
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, password: true }))}
              error={touched.password ? passwordError : ""}
              placeholder="Enter your password"
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="text-[11px] font-medium text-[#0097B2] hover:underline"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              }
            />
          </div>

          {loginError ? (
            <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
              {loginError}
            </p>
          ) : null}

          <div className="mt-6">
            <PrimaryButton type="submit" disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
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
