"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { TWO_FACTOR_AUTH_COUNTDOWN_SECONDS } from "@/lib/constants";
import PrimaryButton from "@/components/ui/PrimaryButton";
import {
  resendTwoFactor as defaultResendTwoFactor,
  saveAuthSession as defaultSaveAuthSession,
  verifyTwoFactor as defaultVerifyTwoFactor,
} from "@/lib/auth/authApi";
import { applyApiFieldErrors, getApiErrorMessage } from "@/lib/apiErrorUtils";

export default function TwoFactorAuthModal({
  isOpen,
  onClose,
  onSuccess,
  email,
  sessionToken,
  verifyFn = defaultVerifyTwoFactor,
  resendFn = defaultResendTwoFactor,
  saveSessionFn = defaultSaveAuthSession,
  subtitle = "Legal Practice Management Portal",
}) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(TWO_FACTOR_AUTH_COUNTDOWN_SECONDS);
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef([]);
  const openSession = isOpen ? sessionToken || "open" : null;
  const [prevOpenSession, setPrevOpenSession] = useState(null);

  if (openSession !== prevOpenSession) {
    setPrevOpenSession(openSession);

    if (openSession) {
      setOtp(["", "", "", "", "", ""]);
      setCountdown(TWO_FACTOR_AUTH_COUNTDOWN_SECONDS);
      setTrustDevice(false);
      setError("");
      setIsVerifying(false);
      setIsResending(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOpen, countdown]);

  if (!isOpen) return null;

  const submitCode = async (code) => {
    if (!sessionToken || isVerifying) return;

    setIsVerifying(true);
    setError("");

    try {
      const response = await verifyFn({
        sessionToken,
        code,
        trustDevice,
      });

      const payload = response?.data || {};

      saveSessionFn({
        user: payload.user,
        accessExpiresAt: payload.accessExpiresAt,
      });

      // Allow personal portal login to await a "session verified" call
      // before routing.
      await Promise.resolve(onSuccess?.());
    } catch (requestError) {
      const { fieldErrors, message } = applyApiFieldErrors(requestError, {
        code: "otp",
      });

      setError(
        fieldErrors.otp ||
          message ||
          getApiErrorMessage(requestError, "Invalid verification code")
      );
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (isVerifying) return;

    const digit = value.replace(/\D/g, "");

    if (!digit) {
      const updatedOtp = [...otp];
      updatedOtp[index] = "";
      setOtp(updatedOtp);
      return;
    }

    const updatedOtp = [...otp];
    updatedOtp[index] = digit.slice(-1);
    setOtp(updatedOtp);
    setError("");

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const finalOtp = updatedOtp.join("");

    if (finalOtp.length === 6) {
      submitCode(finalOtp);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (e.key === "Escape") {
      onClose?.();
    }
  };

  const handlePaste = (e) => {
    if (isVerifying) return;

    e.preventDefault();

    const pastedValue = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pastedValue) return;

    const updatedOtp = ["", "", "", "", "", ""];

    pastedValue.split("").forEach((digit, index) => {
      updatedOtp[index] = digit;
    });

    setOtp(updatedOtp);
    setError("");

    const nextIndex = pastedValue.length >= 6 ? 5 : pastedValue.length;
    inputRefs.current[nextIndex]?.focus();

    if (pastedValue.length === 6) {
      submitCode(pastedValue);
    }
  };

  const handleResendCode = async () => {
    if (!sessionToken || isResending || countdown > 0) return;

    setIsResending(true);
    setError("");

    try {
      await resendFn(sessionToken);
      setOtp(["", "", "", "", "", ""]);
      setCountdown(TWO_FACTOR_AUTH_COUNTDOWN_SECONDS);
      inputRefs.current[0]?.focus();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to resend code"));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center px-4"
      style={{
        background:
          "radial-gradient(circle at 12% 0%, rgba(0, 151, 178, 0.10), transparent 28%), linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
      }}
    >
      <div className="w-full max-w-[410px]">
        <div className="mb-[24px] text-center">
          <div className="mx-auto mb-[14px] flex justify-center">
            <Image
              src="/images/logo.png"
              alt="DMS Logo"
              width={62}
              height={40}
              priority
              style={{ height: "auto" }}
              className="w-[62px]"
            />
          </div>

          <p className="text-[12px] text-[#64748B]">
            {subtitle}
          </p>
        </div>

        <section className="rounded-[9px] border border-[#E2E8F0] bg-white px-[44px] py-[34px] text-center shadow-sm">
          <div className="mx-auto mb-[18px] flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#E6F7FA]">
            <ShieldIcon />
          </div>

          <h2 className="text-[17px] font-semibold text-[#111827]">
            Two-Factor Authentication
          </h2>

          <p className="mt-[8px] text-[13px] text-[#64748B]">
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-[#334155]">{email}</span>
          </p>

          <div className="mt-[22px] flex justify-center gap-[10px]">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                disabled={isVerifying}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="h-[54px] w-[42px] rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] text-center text-[18px] font-medium text-[#111827] outline-none transition focus:border-[#0097B2] focus:bg-white focus:ring-2 focus:ring-[#0097B2]/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            ))}
          </div>

          {error && (
            <p className="mt-4 text-[12px] font-medium text-red-600">{error}</p>
          )}

          {isVerifying && (
            <p className="mt-4 text-[12px] text-[#64748B]">Verifying code...</p>
          )}

          <label className="mt-[22px] flex items-center justify-center gap-[8px] text-[13px] text-[#475569]">
            <input
              type="checkbox"
              checked={trustDevice}
              disabled={isVerifying}
              onChange={(e) => setTrustDevice(e.target.checked)}
              className="h-[13px] w-[13px] rounded border-[#CBD5E1] accent-[#0097B2]"
            />
            Trust this device for 30 days
          </label>

          <div className="mt-[20px] text-[13px]">
            {countdown > 0 ? (
              <p className="text-[#94A3B8]">
                Resend code in{" "}
                <span className="font-medium text-[#64748B]">
                  {countdown}s
                </span>
              </p>
            ) : (
              <div className="mx-auto w-full max-w-[160px]">
                <PrimaryButton
                  type="button"
                  disabled={isResending}
                  onClick={handleResendCode}
                >
                  {isResending ? "Sending..." : "Resend Code"}
                </PrimaryButton>
              </div>
            )}
          </div>
        </section>

        <p className="mt-[24px] text-center text-[11px] text-[#94A3B8]">
          Authorized personnel only · DMS Document Management System
        </p>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#0097B2"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
