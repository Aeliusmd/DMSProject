"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CompanyPortalShell from "@/components/company-portal/CompanyPortalShell";
import CompanyRegisterFormFields from "@/components/company-portal/CompanyRegisterFormFields";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { registerCompany } from "@/lib/company-portal/companyPortalAuthApi";
import {
  buildCompanyRegisterPayload,
  hasValidationErrors,
  sanitizeCompanyRegisterField,
  sanitizeEmail,
  validateCompanyRegisterForm,
} from "@/lib/company-portal/companyPortalValidation";
import {
  applyApiFieldErrors,
  getApiErrorMessage,
  shouldShowSubmitError,
} from "@/lib/apiErrorUtils";

const INITIAL_FORM = {
  companyName: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
};

export default function SubpoenaUploadRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL_FORM);
  const [touched, setTouched] = useState({});
  const [apiFieldErrors, setApiFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const localErrors = useMemo(() => validateCompanyRegisterForm(form), [form]);
  const errors = { ...localErrors, ...apiFieldErrors };
  const isFormValid = !hasValidationErrors(localErrors);

  const handleChange = (name, value) => {
    setForm((prev) => ({
      ...prev,
      [name]: sanitizeCompanyRegisterField(name, value),
    }));
    setApiFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setSubmitError("");
  };

  const handleBlur = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setTouched({
      companyName: true,
      phone: true,
      email: true,
      password: true,
      confirmPassword: true,
      addressLine1: true,
      city: true,
      state: true,
      zip: true,
    });

    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError("");
    setApiFieldErrors({});

    try {
      await registerCompany(buildCompanyRegisterPayload(form));
      router.push("/company-portal/login?registered=1");
    } catch (error) {
      const { fieldErrors, message } = applyApiFieldErrors(error);
      setApiFieldErrors(fieldErrors);

      if (shouldShowSubmitError(message, fieldErrors)) {
        setSubmitError(
          message ||
            getApiErrorMessage(error, "Unable to register. Please try again.")
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CompanyPortalShell
      title="Register your company"
      subtitle="Company Portal · Subpoena Upload"
      maxWidthClassName="max-w-[560px]"
      footer={
        <p>
          Already have an account?{" "}
          <Link
            href="/company-portal/login"
            className="font-medium text-[#0097B2] hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <CompanyRegisterFormFields
          form={form}
          errors={errors}
          touched={touched}
          showPassword={showPassword}
          showConfirmPassword={showConfirmPassword}
          onChange={handleChange}
          onBlur={handleBlur}
          onTogglePassword={() => setShowPassword((prev) => !prev)}
          onToggleConfirmPassword={() =>
            setShowConfirmPassword((prev) => !prev)
          }
        />

        {submitError ? (
          <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
            {submitError}
          </p>
        ) : null}

        <div className="mt-5">
          <PrimaryButton type="submit" disabled={!isFormValid || isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </PrimaryButton>
        </div>
      </form>
    </CompanyPortalShell>
  );
}
