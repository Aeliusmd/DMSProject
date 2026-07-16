"use client";

import AuthInput from "@/components/ui/AuthInput";

export default function CompanyRegisterFormFields({
  form,
  errors,
  touched,
  onChange,
  onBlur,
}) {
  const field = (name) => ({
    value: form[name],
    onChange: (event) => onChange(name, event.target.value),
    onBlur: () => onBlur(name),
    error: touched[name] ? errors[name] : "",
  });

  return (
    <div className="space-y-4">
      <AuthInput
        label="Company Name"
        placeholder="Enter company name"
        {...field("companyName")}
      />

      <AuthInput
        label="Company Phone Number"
        type="tel"
        placeholder="10-digit phone number"
        {...field("phone")}
      />

      <AuthInput
        label="Company Email"
        type="email"
        placeholder="company@email.com"
        {...field("email")}
      />

      <p className="text-[12px] leading-relaxed text-[#6B7280]">
        You&apos;ll sign in with this email using a one-time verification code.
        No password is required.
      </p>

      <AuthInput
        label="Company Address"
        placeholder="Street address"
        {...field("addressLine1")}
      />

      <AuthInput
        label="Address Line 2 (optional)"
        placeholder="Suite, unit, etc."
        {...field("addressLine2")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AuthInput label="City" placeholder="City" {...field("city")} />
        <AuthInput label="State" placeholder="CA" {...field("state")} />
        <AuthInput label="ZIP" placeholder="91723" {...field("zip")} />
      </div>
    </div>
  );
}
