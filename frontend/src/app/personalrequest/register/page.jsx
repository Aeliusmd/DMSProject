"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PersonalPortalAuthShell from "@/components/personal-request/PersonalPortalAuthShell";
import AuthInput from "@/components/ui/AuthInput";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { registerPersonal } from "@/lib/personal-request/personalPortalAuthApi";
import { isPersonalAuthenticated } from "@/lib/personal-request/personalPortalAuthStorage";
import {
  applyApiFieldErrors,
  getApiErrorMessage,
  shouldShowSubmitError,
} from "@/lib/apiErrorUtils";

export default function PersonalPortalRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState({});
  const [apiFieldErrors, setApiFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isPersonalAuthenticated()) {
      router.replace("/personalrequest/dashboard");
    }
  }, [router]);

  const errors = {
    firstName: !form.firstName.trim() ? "First name is required" : "",
    lastName: !form.lastName.trim() ? "Last name is required" : "",
    email: !form.email.trim()
      ? "Email is required"
      : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())
        ? "Enter a valid email"
        : "",
    password:
      !form.password
        ? "Password is required"
        : form.password.length < 8
          ? "Password must be at least 8 characters"
          : "",
    confirmPassword:
      !form.confirmPassword
        ? "Please re-enter your password"
        : form.confirmPassword !== form.password
          ? "Passwords do not match"
          : "",
    ...apiFieldErrors,
  };

  const isValid = Object.values(errors).every((value) => !value);

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setApiFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError("");
    setApiFieldErrors({});

    try {
      await registerPersonal({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      router.push("/personalrequest/login?registered=1");
    } catch (error) {
      const { fieldErrors, message } = applyApiFieldErrors(error);
      if (Object.keys(fieldErrors).length > 0) setApiFieldErrors(fieldErrors);
      if (shouldShowSubmitError(message, fieldErrors)) {
        setSubmitError(
          message || getApiErrorMessage(error, "Unable to register. Please try again.")
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const show = (name) => (touched[name] ? errors[name] : "");

  return (
    <PersonalPortalAuthShell
      title="Create personal account"
      subtitle="Personal Request Portal"
      maxWidthClassName="max-w-[520px]"
      footer={
        <p>
          Already have an account?{" "}
          <Link
            href="/personalrequest/login"
            className="font-medium text-[#0097B2] hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <p className="mb-5 rounded-[6px] border border-[#D0E8ED] bg-[#E6F7FA] px-3 py-2 text-[12px] text-[#0B7C8E]">
        Register once with your email so you can submit multiple record requests and track
        them all in one place.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthInput
            label="First name"
            value={form.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, firstName: true }))}
            error={show("firstName")}
            placeholder="First name"
          />
          <AuthInput
            label="Last name"
            value={form.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, lastName: true }))}
            error={show("lastName")}
            placeholder="Last name"
          />
        </div>

        <AuthInput
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => handleChange("email", e.target.value)}
          onBlur={() => setTouched((p) => ({ ...p, email: true }))}
          error={show("email")}
          placeholder="you@example.com"
        />

        <AuthInput
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => handleChange("password", e.target.value)}
          onBlur={() => setTouched((p) => ({ ...p, password: true }))}
          error={show("password")}
          placeholder="At least 8 characters"
        />

        <AuthInput
          label="Confirm password"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => handleChange("confirmPassword", e.target.value)}
          onBlur={() => setTouched((p) => ({ ...p, confirmPassword: true }))}
          error={show("confirmPassword")}
          placeholder="Re-enter password"
        />

        {submitError ? (
          <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
            {submitError}
          </p>
        ) : null}

        <PrimaryButton type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </PrimaryButton>
      </form>
    </PersonalPortalAuthShell>
  );
}
