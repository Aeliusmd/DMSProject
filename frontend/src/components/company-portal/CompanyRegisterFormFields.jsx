"use client";

import AuthInput from "@/components/ui/AuthInput";

export default function CompanyRegisterFormFields({
  form,
  errors,
  touched,
  showPassword,
  showConfirmPassword,
  onChange,
  onBlur,
  onTogglePassword,
  onToggleConfirmPassword,
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

      <AuthInput
        label="Password"
        type={showPassword ? "text" : "password"}
        placeholder="Create a password"
        {...field("password")}
        rightIcon={
          <button
            type="button"
            onClick={onTogglePassword}
            className="text-[11px] font-medium text-[#0097B2] hover:underline"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        }
      />

      <AuthInput
        label="Re-enter Password"
        type={showConfirmPassword ? "text" : "password"}
        placeholder="Confirm password"
        {...field("confirmPassword")}
        rightIcon={
          <button
            type="button"
            onClick={onToggleConfirmPassword}
            className="text-[11px] font-medium text-[#0097B2] hover:underline"
          >
            {showConfirmPassword ? "Hide" : "Show"}
          </button>
        }
      />

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
