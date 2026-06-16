"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { TWO_FACTOR_AUTH_COUNTDOWN_SECONDS } from "@/lib/constants";
import PrimaryButton from "@/components/ui/PrimaryButton";

export default function TwoFactorAuthModal({ isOpen, onClose, email }) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(TWO_FACTOR_AUTH_COUNTDOWN_SECONDS);
  const [trustDevice, setTrustDevice] = useState(false);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (!isOpen) return;

    setOtp(["", "", "", "", "", ""]);
    setCountdown(TWO_FACTOR_AUTH_COUNTDOWN_SECONDS);
    setTrustDevice(false);

    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
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

  const handleOtpChange = (index, value) => {
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

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const finalOtp = updatedOtp.join("");

    if (finalOtp.length === 6) {
      console.log("2FA code entered:", finalOtp);
      console.log("Email:", email);
      console.log("Trust device:", trustDevice);

      // Later: call verify 2FA API here
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

    const nextIndex = pastedValue.length >= 6 ? 5 : pastedValue.length;
    inputRefs.current[nextIndex]?.focus();

    if (pastedValue.length === 6) {
      console.log("2FA code pasted:", pastedValue);
      console.log("Email:", email);

      // Later: call verify 2FA API here
    }
  };

  const handleResendCode = () => {
    setOtp(["", "", "", "", "", ""]);
    setCountdown(TWO_FACTOR_AUTH_COUNTDOWN_SECONDS);
    inputRefs.current[0]?.focus();

    console.log("Resend 2FA code");
    console.log("Email:", email);

    // Later: call resend 2FA API here
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
              className="h-auto w-[62px]"
            />
          </div>

          <p className="text-[12px] text-[#64748B]">
            Legal Practice Management Portal
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
            Enter the 6-digit code sent to your email
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
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="h-[54px] w-[42px] rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] text-center text-[18px] font-medium text-[#111827] outline-none transition focus:border-[#0097B2] focus:bg-white focus:ring-2 focus:ring-[#0097B2]/10"
              />
            ))}
          </div>

          <label className="mt-[22px] flex items-center justify-center gap-[8px] text-[13px] text-[#475569]">
            <input
              type="checkbox"
              checked={trustDevice}
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
                <PrimaryButton type="button" onClick={handleResendCode}>
                  Resend Code
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