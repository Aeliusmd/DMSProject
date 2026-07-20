"use client";

import { useEffect, useMemo, useState } from "react";
import AuthInput from "@/components/ui/AuthInput";
import PrimaryButton from "@/components/ui/PrimaryButton";
import {
  applyApiFieldErrors,
  getApiErrorMessage,
} from "@/lib/apiErrorUtils";

export default function CompanyCreateEmployeeModal({
  isOpen,
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setForm({ name: "", email: "", password: "" });
    setErrors({});
    setSubmitError("");
  }, [isOpen]);

  const localErrors = useMemo(() => {
    const next = {};
    if (!form.name.trim()) next.name = "Employee name is required";
    if (!form.email.trim()) next.email = "Email is required";
    if (!form.password) next.password = "Password is required";
    else if (form.password.length < 8) {
      next.password = "Password must be at least 8 characters";
    }
    return next;
  }, [form]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors(localErrors);
    if (Object.keys(localErrors).length > 0 || submitting) return;

    setSubmitError("");
    try {
      await onSubmit({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
    } catch (error) {
      const { fieldErrors, message } = applyApiFieldErrors(error);
      setErrors((prev) => ({ ...prev, ...fieldErrors }));
      setSubmitError(
        message || getApiErrorMessage(error, "Unable to create employee")
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[480px] rounded-[12px] bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[#0F172A]">
              Create employee account
            </h2>
            <p className="mt-1 text-[12px] text-[#64748B]">
              Credentials will be emailed to the employee after creation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#64748B]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <AuthInput
            label="Full name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            error={errors.name}
            placeholder="Employee name"
          />
          <AuthInput
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            error={errors.email}
            placeholder="employee@company.com"
          />
          <AuthInput
            label="Password"
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, password: event.target.value }))
            }
            error={errors.password}
            placeholder="Minimum 8 characters"
          />

          {submitError ? (
            <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
              {submitError}
            </p>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] font-medium text-[#334155]"
            >
              Cancel
            </button>
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create employee"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
