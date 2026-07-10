"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CompanyPortalShell from "@/components/company-portal/CompanyPortalShell";
import TwoFactorAuthModal from "@/components/auth/TwoFactorAuthModal";
import AuthInput from "@/components/ui/AuthInput";
import PrimaryButton from "@/components/ui/PrimaryButton";
import {
  loginCompany,
  resendCompanyTwoFactor,
  saveCompanyAuthSession,
  verifyCompanyTwoFactor,
} from "@/lib/company-portal/companyPortalAuthApi";
import { isCompanyAuthenticated } from "@/lib/company-portal/companyPortalAuthStorage";
import {
  sanitizeInput,
  validateCompanyEmail,
  validatePassword,
} from "@/lib/company-portal/companyPortalValidation";
import {
  applyApiFieldErrors,
  getApiErrorMessage,
  shouldShowSubmitError,
} from "@/lib/apiErrorUtils";

export default function CompanyPortalLoginClient() {
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
    if (isCompanyAuthenticated()) {
      router.replace("/company-portal/profile");
    }
  }, [router]);

  const emailError = apiFieldErrors.email || validateCompanyEmail(email);
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
      const response = await loginCompany({
        email: sanitizeInput(email, 255).toLowerCase(),
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

      if (Object.keys(fieldErrors).length > 0) {
        setApiFieldErrors(fieldErrors);
      }

      if (shouldShowSubmitError(message, fieldErrors)) {
        setLoginError(
          message ||
            getApiErrorMessage(error, "Unable to sign in. Please try again.")
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <CompanyPortalShell
        title="Company sign in"
        subtitle="Company Portal"
        footer={
          <p>
            Need an account?{" "}
            <Link
              href="/Subpoenaupload"
              className="font-medium text-[#0097B2] hover:underline"
            >
              Register your company
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
              label="Company Email"
              type="email"
              placeholder="company@email.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setApiFieldErrors((prev) => {
                  if (!prev.email) return prev;
                  const next = { ...prev };
                  delete next.email;
                  return next;
                });
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
              error={touched.email ? emailError : ""}
            />

            <AuthInput
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setApiFieldErrors((prev) => {
                  if (!prev.password) return prev;
                  const next = { ...prev };
                  delete next.password;
                  return next;
                });
              }}
              onBlur={() =>
                setTouched((prev) => ({ ...prev, password: true }))
              }
              error={touched.password ? passwordError : ""}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-[11px] font-medium text-[#0097B2] hover:underline"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              }
            />
          </div>

          {loginError ? (
            <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
              {loginError}
            </p>
          ) : null}

          <div className="mt-5">
            <PrimaryButton
              type="submit"
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </PrimaryButton>
          </div>
        </form>
      </CompanyPortalShell>

      <TwoFactorAuthModal
        isOpen={isTwoFactorOpen}
        email={maskedEmail}
        sessionToken={sessionToken}
        subtitle="Company Portal"
        verifyFn={verifyCompanyTwoFactor}
        resendFn={resendCompanyTwoFactor}
        saveSessionFn={saveCompanyAuthSession}
        onClose={() => {
          setIsTwoFactorOpen(false);
          setSessionToken("");
          setMaskedEmail("");
        }}
        onSuccess={() => {
          setIsTwoFactorOpen(false);
          setSessionToken("");
          router.push("/company-portal/profile");
        }}
      />
    </>
  );
}
