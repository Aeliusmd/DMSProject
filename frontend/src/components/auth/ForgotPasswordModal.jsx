"use client";

import { useMemo, useState } from "react";
import AuthInput from "@/components/ui/AuthInput";
import PrimaryButton from "@/components/ui/PrimaryButton";
import TwoFactorAuthModal from "@/components/auth/TwoFactorAuthModal";
import AlertModal from "@/components/ui/AlertModal";
import {
  requestPasswordReset,
  resendForgotPassword,
  verifyForgotPassword,
} from "@/lib/auth/authApi";
import { validateForgotPasswordForm } from "@/lib/passwordValidations";
import { applyApiFieldErrors, getApiErrorMessage } from "@/lib/apiErrorUtils";

export default function ForgotPasswordModal({ isOpen, onClose, initialEmail = "" }) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [apiFieldErrors, setApiFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const [prevOpen, setPrevOpen] = useState(false);

  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);

    if (isOpen) {
      setEmail(initialEmail || "");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setTouched({ email: false, password: false, confirmPassword: false });
      setApiFieldErrors({});
      setFormError("");
      setIsSubmitting(false);
      setSessionToken("");
      setMaskedEmail("");
      setIsOtpOpen(false);
      setSuccessOpen(false);
    }
  }

  const localErrors = useMemo(
    () =>
      validateForgotPasswordForm({
        email,
        password,
        confirmPassword,
      }),
    [email, password, confirmPassword]
  );

  const emailError = apiFieldErrors.email || localErrors.email || "";
  const passwordError = apiFieldErrors.password || localErrors.password || "";
  const confirmPasswordError =
    apiFieldErrors.confirmPassword || localErrors.confirmPassword || "";
  const isFormValid = !emailError && !passwordError && !confirmPasswordError;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setTouched({
      email: true,
      password: true,
      confirmPassword: true,
    });

    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setFormError("");
    setApiFieldErrors({});

    try {
      const response = await requestPasswordReset({
        email: email.trim(),
        password,
        confirmPassword,
      });
      const payload = response?.data || {};

      setSessionToken(payload.sessionToken || "");
      setMaskedEmail(payload.email || email.trim());
      setIsOtpOpen(true);
    } catch (error) {
      const { fieldErrors, message } = applyApiFieldErrors(error, {
        identifier: "email",
      });

      if (Object.keys(fieldErrors).length > 0) {
        setApiFieldErrors(fieldErrors);
      }

      setFormError(
        message ||
          getApiErrorMessage(error, "Unable to start password reset. Please try again.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSuccess = async () => {
    setIsOtpOpen(false);
    setSuccessOpen(true);
  };

  const handleSuccessClose = () => {
    setSuccessOpen(false);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <>
      {!isOtpOpen && !successOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]">
          <section className="w-full max-w-[420px] rounded-[9px] border border-[#E2E8F0] bg-white px-[26px] py-[28px] shadow-2xl">
            <div className="mb-5">
              <h2 className="text-[16px] font-semibold text-[#111827]">
                Forgot password
              </h2>
              <p className="mt-1 text-[12px] text-[#64748B]">
                Enter your email and a new password. We will send a verification
                code before the password is updated.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-[16px]">
              <AuthInput
                label="Email Address"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setApiFieldErrors((prev) => {
                    if (!prev.email) return prev;
                    const next = { ...prev };
                    delete next.email;
                    return next;
                  });
                }}
                onBlur={() =>
                  setTouched((prev) => ({
                    ...prev,
                    email: true,
                  }))
                }
                leftIcon={<MailIcon />}
                error={touched.email ? emailError : ""}
              />

              <AuthInput
                label="New Password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a new password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setApiFieldErrors((prev) => {
                    if (!prev.password) return prev;
                    const next = { ...prev };
                    delete next.password;
                    return next;
                  });
                }}
                onBlur={() =>
                  setTouched((prev) => ({
                    ...prev,
                    password: true,
                  }))
                }
                leftIcon={<LockIcon />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="flex items-center justify-center text-[#94A3B8] hover:text-[#64748B]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                }
                error={touched.password ? passwordError : ""}
              />

              <AuthInput
                label="Re-enter Password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setApiFieldErrors((prev) => {
                    if (!prev.confirmPassword) return prev;
                    const next = { ...prev };
                    delete next.confirmPassword;
                    return next;
                  });
                }}
                onBlur={() =>
                  setTouched((prev) => ({
                    ...prev,
                    confirmPassword: true,
                  }))
                }
                leftIcon={<LockIcon />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="flex items-center justify-center text-[#94A3B8] hover:text-[#64748B]"
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                }
                error={touched.confirmPassword ? confirmPasswordError : ""}
              />

              <p className="text-[11px] leading-[16px] text-[#94A3B8]">
                Password must be 8–128 characters and include uppercase,
                lowercase, a number, and a special character.
              </p>

              {formError ? (
                <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
                  {formError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex h-[38px] items-center justify-center rounded-[6px] bg-[#F8FAFC] px-4 text-[12px] font-semibold text-[#334155] hover:bg-[#E2E8F0]"
                >
                  Cancel
                </button>
                <div className="w-[160px]">
                  <PrimaryButton
                    type="submit"
                    disabled={!isFormValid || isSubmitting}
                  >
                    {isSubmitting ? "Sending..." : "Update Password"}
                  </PrimaryButton>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      <TwoFactorAuthModal
        isOpen={isOtpOpen}
        onClose={() => setIsOtpOpen(false)}
        onSuccess={handleOtpSuccess}
        email={maskedEmail || email}
        sessionToken={sessionToken}
        verifyFn={verifyForgotPassword}
        resendFn={resendForgotPassword}
        persistSession={false}
        showTrustDevice={false}
        title="Verify Password Reset"
      />

      <AlertModal
        open={successOpen}
        title="Password Updated"
        message="Your password was changed successfully. You can now sign in with your new password."
        variant="success"
        confirmLabel="Back to login"
        onClose={handleSuccessClose}
      />
    </>
  );
}

function MailIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7 10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.88 9.88A3 3 0 0 0 14.12 14.12" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="M2 2l20 20" />
    </svg>
  );
}
