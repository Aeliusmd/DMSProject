"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PersonalRequestShell from "@/components/personal-request/PersonalRequestShell";
import RequestStepper from "@/components/personal-request/RequestStepper";
import PersonalFacilitySearchField from "@/components/personal-request/PersonalFacilitySearchField";
import { TWO_FACTOR_AUTH_COUNTDOWN_SECONDS } from "@/lib/constants";
import {
  confirmPersonalRequestOtp,
  fetchPersonalRequestConfig,
  sendPersonalRequestOtp,
  submitPersonalRequest,
} from "@/lib/personal-request/personalRequestApi";
import {
  RECORD_TYPE_OPTIONS,
  toApiDate,
  validatePersonalRequestForm,
} from "@/lib/validations/personalRequestValidation";
import { applyApiFieldErrors, getApiErrorMessage } from "@/lib/apiErrorUtils";
import {
  loadPersonalRequestDraft,
  savePersonalRequestDraft,
} from "@/lib/personal-request/personalRequestDraft";

const INITIAL_FORM = {
  email: "",
  firstName: "",
  lastName: "",
  dob: "",
  facilityId: "",
  treatingFacilityName: "",
  treatingFacilityAddress: "",
  recordsDateBegin: "",
  recordsDateEnd: "",
  recordTypes: { medical: false, billing: false, xrays: false },
  driverLicenseNumber: "",
  driverLicenseFile: null,
  deliveryPreference: "download",
  mailAddress: "",
};

function FieldLabel({ children, required }) {
  return (
    <label className="mb-1.5 block text-[12px] font-semibold text-[#334155]">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </label>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] font-medium text-red-500">{message}</p>;
}

function TextInput({
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  error,
}) {
  return (
    <input
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`h-[42px] w-full rounded-[8px] border bg-white px-3 text-[13px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
        error
          ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
          : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
      }`}
    />
  );
}

function DateInput({ name, value, onChange, onBlur, error }) {
  return (
    <div className="relative">
      <input
        name={name}
        type="date"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className={`h-[42px] w-full rounded-[8px] border bg-white px-3 pr-10 text-[13px] text-[#111827] outline-none focus:ring-2 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
            : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  );
}

export default function PersonalRequestPage() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled") === "1";
  const fileInputRef = useRef(null);
  const otpRefs = useRef([]);
  const draftHydratedRef = useRef(false);

  const [config, setConfig] = useState({ processingFee: "35.00", lookupDays: 7 });
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [apiErrors, setApiErrors] = useState({});
  const [bannerError, setBannerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState("");
  const [otpSessionToken, setOtpSessionToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    if (draftHydratedRef.current) return;
    draftHydratedRef.current = true;

    const draft = loadPersonalRequestDraft();
    if (draft?.form) {
      setForm({
        ...INITIAL_FORM,
        ...draft.form,
        driverLicenseFile: null,
      });
    }

    const verified = Boolean(draft?.emailVerified && draft?.emailVerificationToken);
    if (verified) {
      setEmailVerified(true);
      setEmailVerificationToken(draft.emailVerificationToken);
      setOtpSent(false);
    }

    if (canceled && verified) {
      setStep(2);
      setBannerError(
        "Payment was canceled. Re-upload your driver's license if needed, then pay again."
      );
    } else if (canceled && !verified) {
      setStep(1);
      setBannerError(
        "Payment was canceled. Please verify your email with OTP to continue."
      );
    } else if (verified && draft?.step === 2) {
      setStep(2);
    }

    setDraftReady(true);
  }, [canceled]);

  useEffect(() => {
    fetchPersonalRequestConfig()
      .then(setConfig)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!draftReady) return;

    savePersonalRequestDraft({
      form: {
        ...form,
        driverLicenseFile: null,
      },
      emailVerified,
      emailVerificationToken,
      step,
    });
  }, [form, emailVerified, emailVerificationToken, step, draftReady]);
  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const formErrors = useMemo(
    () => ({
      ...validatePersonalRequestForm(form, { emailVerified }),
      ...apiErrors,
    }),
    [form, emailVerified, apiErrors]
  );

  const getError = (name) => {
    if (touched[name] || submitAttempted) return formErrors[name] || "";
    return "";
  };

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;

    if (type === "file") {
      setForm((prev) => ({ ...prev, driverLicenseFile: files?.[0] || null }));
      setTouched((prev) => ({ ...prev, driverLicenseFile: true }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleBlur = (e) => {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  };

  const toggleRecordType = (id) => {
    setForm((prev) => ({
      ...prev,
      recordTypes: {
        ...prev.recordTypes,
        [id]: !prev.recordTypes[id],
      },
    }));
    setTouched((prev) => ({ ...prev, recordTypes: true }));
  };

  const handleSendOtp = async () => {
    setBannerError("");
    setOtpError("");

    const email = form.email.trim().toLowerCase();
    if (!email) {
      setOtpError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setOtpError("Enter a valid email address");
      return;
    }

    setSendingOtp(true);
    try {
      const result = await sendPersonalRequestOtp(email);
      setOtpSessionToken(result.sessionToken);
      setOtpSent(true);
      setOtpDigits(["", "", "", "", "", ""]);
      setCountdown(TWO_FACTOR_AUTH_COUNTDOWN_SECONDS);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      setOtpError(getApiErrorMessage(err, "Unable to send verification code."));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpChange = (index, raw) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setOtpError("");

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((ch, i) => {
      next[i] = ch;
    });
    setOtpDigits(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerifyOtp = async () => {
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setOtpError("Enter the 6-digit verification code");
      return;
    }

    setVerifyingOtp(true);
    setOtpError("");

    try {
      const data = await confirmPersonalRequestOtp({
        email: form.email.trim().toLowerCase(),
        sessionToken: otpSessionToken,
        code,
      });
      setEmailVerified(true);
      setEmailVerificationToken(data.emailVerificationToken);
      setOtpSent(false);
      savePersonalRequestDraft({
        form: { ...form, driverLicenseFile: null },
        emailVerified: true,
        emailVerificationToken: data.emailVerificationToken,
        step,
      });
    } catch (err) {
      setOtpError(getApiErrorMessage(err, "Invalid verification code"));
      setOtpDigits(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setVerifyingOtp(false);
    }
  };

  const selectedRecordLabels = RECORD_TYPE_OPTIONS.filter(
    (opt) => form.recordTypes[opt.id]
  ).map((opt) => opt.label);

  const handleContinueToPayment = () => {
    setSubmitAttempted(true);
    setBannerError("");
    setApiErrors({});

    if (!emailVerified || !emailVerificationToken) {
      setBannerError("Please verify your email with the OTP before continuing to payment.");
      return;
    }

    const errors = validatePersonalRequestForm(form, { emailVerified: true });
    if (Object.keys(errors).length > 0) {
      setBannerError("Please complete all required fields before continuing.");
      return;
    }

    // Keep verified email so returning from Stripe does not require another OTP
    savePersonalRequestDraft({
      form: { ...form, driverLicenseFile: null },
      emailVerified: true,
      emailVerificationToken,
      step: 2,
    });

    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePay = async () => {
    setBannerError("");
    setApiErrors({});

    if (!emailVerified || !emailVerificationToken) {
      setBannerError("Email verification expired. Go back and verify your email again.");
      return;
    }

    if (!form.driverLicenseFile) {
      setBannerError("Please go back and upload your driver's license before paying.");
      return;
    }

    setSubmitting(true);

    try {
      const selectedTypes = RECORD_TYPE_OPTIONS.filter(
        (opt) => form.recordTypes[opt.id]
      ).map((opt) => opt.id);

      const payload = new FormData();
      payload.append("email", form.email.trim().toLowerCase());
      payload.append("emailVerificationToken", emailVerificationToken);
      payload.append("firstName", form.firstName.trim());
      payload.append("lastName", form.lastName.trim());
      payload.append("dob", toApiDate(form.dob));
      payload.append("treatingFacilityName", form.treatingFacilityName.trim());
      payload.append("treatingFacilityAddress", form.treatingFacilityAddress.trim());
      if (form.facilityId) {
        payload.append("facilityId", String(form.facilityId));
      }
      payload.append("recordsDateBegin", toApiDate(form.recordsDateBegin));
      payload.append("recordsDateEnd", toApiDate(form.recordsDateEnd));
      payload.append("recordTypes", JSON.stringify(selectedTypes));
      payload.append("driverLicenseNumber", form.driverLicenseNumber.trim());
      payload.append("deliveryPreference", form.deliveryPreference || "download");
      if (form.deliveryPreference === "mail" && form.mailAddress) {
        payload.append("mailAddress", form.mailAddress.trim());
      }
      payload.append("driverLicenseFile", form.driverLicenseFile);

      // Persist verified email before leaving for Stripe so cancel does not force OTP again
      savePersonalRequestDraft({
        form: { ...form, driverLicenseFile: null },
        emailVerified: true,
        emailVerificationToken,
        step: 2,
      });

      const result = await submitPersonalRequest(payload);

      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      setBannerError("Unable to start payment. Please try again.");
    } catch (err) {
      const { fieldErrors, message } = applyApiFieldErrors(err);
      setApiErrors(fieldErrors);
      const errorMessage =
        message || getApiErrorMessage(err, "Submission failed.");
      setBannerError(errorMessage);

      if (/email verification/i.test(errorMessage)) {
        setEmailVerified(false);
        setEmailVerificationToken("");
        setBannerError(
          "Email verification expired. Please verify your email with OTP again, then continue."
        );
        setStep(1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PersonalRequestShell>
      <RequestStepper currentStep={step} />

      {!draftReady ? (
        <section className="rounded-[12px] border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8">
          <p className="py-8 text-center text-[13px] text-[#64748B]">Loading…</p>
        </section>
      ) : null}

      {draftReady && step === 2 ? (
        <section className="rounded-[12px] border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#E6F7FA] text-[#0097B2]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
                <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            </div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
              Payment — ${config.processingFee}
            </h1>
            <p className="mt-2 text-[13px] text-[#64748B]">
              A ${config.processingFee} processing fee is required to begin your personal
              records request. Your order number will be provided after payment.
            </p>
          </div>

          {bannerError ? (
            <div className="mb-5 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
              {bannerError}
            </div>
          ) : null}

          <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] p-4 sm:p-5">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#64748B]">
              Request Summary
            </p>
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Name</dt>
                <dd className="text-right font-medium text-[#111827]">
                  {form.firstName} {form.lastName}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Email</dt>
                <dd className="text-right font-medium text-[#111827]">{form.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">DOB</dt>
                <dd className="text-right font-medium text-[#111827]">{form.dob || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Facility</dt>
                <dd className="text-right font-medium text-[#111827]">
                  {form.treatingFacilityName}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Date Range</dt>
                <dd className="text-right font-medium text-[#111827]">
                  {form.recordsDateBegin} – {form.recordsDateEnd}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Records</dt>
                <dd className="text-right font-medium text-[#111827]">
                  {selectedRecordLabels.join(", ") || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-[#E2E8F0] pt-2.5">
                <dt className="font-semibold text-[#334155]">Total</dt>
                <dd className="font-semibold text-[#0097B2]">${config.processingFee}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setBannerError("");
              }}
              disabled={submitting}
              className="inline-flex h-[46px] flex-1 items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-white text-[14px] font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-60"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handlePay}
              disabled={submitting}
              className="inline-flex h-[46px] flex-[1.4] items-center justify-center rounded-[8px] bg-[#0097B2] text-[14px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
            >
              {submitting ? "Redirecting to Stripe..." : `Pay $${config.processingFee}`}
            </button>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#94A3B8]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" />
            </svg>
            Secure payment processing
          </p>
        </section>
      ) : null}

      {draftReady && step === 1 ? (
      <section className="rounded-[12px] border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#E6F7FA] text-[#0097B2]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
            Personal Records Request
          </h1>
          <p className="mt-2 text-[13px] text-[#64748B]">
            Request your own medical, billing, or imaging records. All fields marked with{" "}
            <span className="text-red-500">*</span> are required.
          </p>
        </div>

        {bannerError ? (
          <div className="mb-5 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
            {bannerError}
          </div>
        ) : null}

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel required>First Name</FieldLabel>
              <TextInput
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. John"
                error={getError("firstName")}
              />
              <FieldError message={getError("firstName")} />
            </div>
            <div>
              <FieldLabel required>Last Name</FieldLabel>
              <TextInput
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. Smith"
                error={getError("lastName")}
              />
              <FieldError message={getError("lastName")} />
            </div>
          </div>

          <div>
            <FieldLabel required>Date of Birth</FieldLabel>
            <DateInput
              name="dob"
              value={form.dob}
              onChange={handleChange}
              onBlur={handleBlur}
              error={getError("dob")}
            />
            <FieldError message={getError("dob")} />
          </div>

          <div
            className={`rounded-[10px] border p-4 ${
              emailVerified
                ? "border-[#A7F3D0] bg-[#F0FDF4]"
                : "border-[#BDECF3] bg-[#F0FDFF]"
            }`}
          >
            <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[#0B7C8E]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 6h16v12H4V6Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              Email Verification
            </div>

            {emailVerified ? (
              <div className="flex items-center gap-3 rounded-[8px] border border-[#A7F3D0] bg-white px-3 py-2.5">
                <p className="flex-1 truncate text-[13px] text-[#111827]">{form.email}</p>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#059669]">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <circle cx="7" cy="7" r="6" fill="#22C55E" />
                    <path d="M4 7.2L6 9.2L10 5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  Verified
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, email: e.target.value }));
                      setOtpError("");
                    }}
                    placeholder="Enter your email address"
                    disabled={otpSent}
                    className="h-[42px] flex-1 rounded-[8px] border border-[#E2E8F0] bg-white px-3 text-[13px] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10 disabled:bg-[#F8FAFC]"
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || (otpSent && countdown > 0)}
                    className="inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-[8px] bg-[#64748B] px-4 text-[12px] font-semibold text-white transition hover:bg-[#475569] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M4 12 20 4l-6 16-2-7-7-2Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {sendingOtp
                      ? "Sending..."
                      : otpSent
                        ? countdown > 0
                          ? `Resend in ${countdown}s`
                          : "Resend OTP"
                        : "Send OTP"}
                  </button>
                </div>

                {otpSent ? (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="flex gap-2" onPaste={handleOtpPaste}>
                        {otpDigits.map((digit, index) => (
                          <input
                            key={`otp-${index}`}
                            ref={(el) => {
                              otpRefs.current[index] = el;
                            }}
                            value={digit}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            inputMode="numeric"
                            maxLength={1}
                            className="h-11 w-10 rounded-[8px] border border-[#E2E8F0] text-center text-[16px] font-semibold outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={verifyingOtp || otpDigits.join("").length !== 6}
                        className="h-[42px] rounded-[8px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
                      >
                        {verifyingOtp ? "Verifying..." : "Verify OTP"}
                      </button>
                    </div>
                    {countdown > 0 ? (
                      <p className="text-[11px] text-[#64748B]">resend in {countdown}s</p>
                    ) : null}
                  </div>
                ) : null}

                {otpError || getError("email") ? (
                  <FieldError message={otpError || getError("email")} />
                ) : null}
              </div>
            )}
          </div>

          <div>
            <PersonalFacilitySearchField
              value={form.treatingFacilityName}
              facilityId={form.facilityId}
              required
              error={getError("treatingFacilityName")}
              onInputChange={(nextValue) => {
                setForm((prev) => ({
                  ...prev,
                  treatingFacilityName: nextValue,
                  facilityId: "",
                }));
              }}
              onSelect={(facility) => {
                setForm((prev) => ({
                  ...prev,
                  facilityId: facility.id ? String(facility.id) : "",
                  treatingFacilityName: facility.facilityName || "",
                  treatingFacilityAddress: facility.address || "",
                }));
                setTouched((prev) => ({
                  ...prev,
                  treatingFacilityName: true,
                  treatingFacilityAddress: true,
                }));
              }}
              onBlur={() =>
                setTouched((prev) => ({ ...prev, treatingFacilityName: true }))
              }
            />
          </div>

          <div>
            <FieldLabel required>Treating Facility Address</FieldLabel>
            <TextInput
              name="treatingFacilityAddress"
              value={form.treatingFacilityAddress}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="e.g. 1234 Wilshire Blvd, Los Angeles, CA 90017"
              error={getError("treatingFacilityAddress")}
            />
            <FieldError message={getError("treatingFacilityAddress")} />
            {form.facilityId && form.treatingFacilityAddress ? (
              <p className="mt-1 text-[11px] text-[#64748B]">
                Address loaded from facility profile. You can edit if needed.
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel required>Records From</FieldLabel>
              <DateInput
                name="recordsDateBegin"
                value={form.recordsDateBegin}
                onChange={handleChange}
                onBlur={handleBlur}
                error={getError("recordsDateBegin")}
              />
              <FieldError message={getError("recordsDateBegin")} />
            </div>
            <div>
              <FieldLabel required>Records To</FieldLabel>
              <DateInput
                name="recordsDateEnd"
                value={form.recordsDateEnd}
                onChange={handleChange}
                onBlur={handleBlur}
                error={getError("recordsDateEnd")}
              />
              <FieldError message={getError("recordsDateEnd")} />
            </div>
          </div>

          <div>
            <FieldLabel required>Type of Records Needed</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-2">
              {RECORD_TYPE_OPTIONS.map((opt) => {
                const selected = Boolean(form.recordTypes[opt.id]);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleRecordType(opt.id)}
                    className={`rounded-full border px-4 py-2 text-[12px] font-semibold transition ${
                      selected
                        ? "border-[#0097B2] bg-[#E6F7FA] text-[#0097B2]"
                        : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <FieldError message={getError("recordTypes")} />
          </div>

          <div>
            <FieldLabel required>Driver&apos;s License Number</FieldLabel>
            <TextInput
              name="driverLicenseNumber"
              value={form.driverLicenseNumber}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Enter license number"
              error={getError("driverLicenseNumber")}
            />
            <FieldError message={getError("driverLicenseNumber")} />
          </div>

          <div>
            <FieldLabel required>Upload Driver&apos;s License</FieldLabel>
            <p className="mb-2 text-[11px] text-[#64748B]">
              Required for identity verification. Accepted: JPEG, PNG, or PDF. Max 10MB.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`flex w-full flex-col items-center justify-center rounded-[10px] border border-dashed px-4 py-8 transition ${
                getError("driverLicenseFile")
                  ? "border-red-400 bg-red-50"
                  : "border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#0097B2] hover:bg-[#F0FDFF]"
              }`}
            >
              <span className="mb-2 text-[#94A3B8]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 8h3l2-2h6l2 2h3v11H4V8Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
              {form.driverLicenseFile ? (
                <>
                  <span className="text-[13px] font-semibold text-[#111827]">
                    {form.driverLicenseFile.name}
                  </span>
                  <span className="mt-1 text-[11px] text-[#64748B]">Click to replace file</span>
                </>
              ) : (
                <>
                  <span className="text-[13px] font-semibold text-[#334155]">Click to upload</span>
                  <span className="mt-1 text-[11px] text-[#94A3B8]">JPEG, PNG, or PDF</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={handleChange}
            />
            <FieldError message={getError("driverLicenseFile")} />
          </div>

          <button
            type="button"
            onClick={handleContinueToPayment}
            disabled={!emailVerified}
            className="mt-2 flex h-[46px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#0097B2] text-[14px] font-semibold text-white transition hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
          >
            Continue to Payment
            <span aria-hidden>→</span>
          </button>

          {!emailVerified ? (
            <p className="text-center text-[11px] text-[#B45309]">
              Verify your email with OTP before continuing to payment.
            </p>
          ) : (
            <p className="text-center text-[11px] text-[#94A3B8]">
              Processing fee: ${config.processingFee}. Payment is required before your
              request enters the queue.
            </p>
          )}
        </div>
      </section>
      ) : null}
    </PersonalRequestShell>
  );
}
