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
  const [touched, setTouched] = useState({ email: false });
  const [apiFieldErrors, setApiFieldErrors] = useState({});
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTwoFactorOpen, setIsTwoFactorOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  useEffect(() => {
    if (isCompanyAuthenticated()) {
      router.replace("/company-portal/dashboard");
    }
  }, [router]);

  const emailError = apiFieldErrors.email || validateCompanyEmail(email);
  const isFormValid = !emailError;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched({ email: true });

    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setLoginError("");
    setApiFieldErrors({});

    try {
      const response = await loginCompany({
        email: sanitizeInput(email, 255).toLowerCase(),
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
            Registration successful. Enter your company email to receive a
            verification code.
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

            <p className="text-[12px] leading-relaxed text-[#6B7280]">
              We&apos;ll send a one-time verification code to this email. No
              password required.
            </p>
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
              {isSubmitting ? "Sending code..." : "Send verification code"}
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
          router.push("/company-portal/dashboard");
        }}
      />
    </>
  );
}
