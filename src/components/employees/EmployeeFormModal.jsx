"use client";

import { useEffect, useState } from "react";

const emptyForm = {
  name: "",
  userName: "",
  password: "",
  email: "",
};

export default function EmployeeFormModal({ open, onClose, onCreate }) {
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!open) return;

    setFormData(emptyForm);
    setErrors({});
    setSubmitAttempted(false);
  }, [open]);

  if (!open) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (submitAttempted) {
      const fieldError = validateField(name, value);

      setErrors((prev) => {
        const nextErrors = { ...prev };

        if (fieldError) {
          nextErrors[name] = fieldError;
        } else {
          delete nextErrors[name];
        }

        return nextErrors;
      });
    }
  };

  const handleSubmit = () => {
    setSubmitAttempted(true);

    const validationErrors = validateEmployeeForm(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    onCreate({
      name: formData.name.trim(),
      userName: formData.userName.trim(),
      logon: formData.userName.trim(),
      password: formData.password,
      email: formData.email.trim(),
    });
  };

  const getError = (field) => {
    if (!submitAttempted) return "";
    return errors[field] || "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]">
      <section
        className="overflow-hidden rounded-[10px] bg-white shadow-2xl"
        style={{
          width: "min(540px, calc(100vw - 32px))",
        }}
      >
        <header className="flex h-[56px] items-center justify-between border-b border-[#E2E8F0] px-5">
          <h2 className="text-[16px] font-semibold text-[#111827]">
            Employee Information
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] text-[#64748B] hover:bg-[#F8FAFC]"
            aria-label="Close employee modal"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="px-5 py-5">
          

          <div className="space-y-4">
            <EmployeeInput
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={getError("name")}
              required
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <EmployeeInput
                label="User Name"
                name="userName"
                value={formData.userName}
                onChange={handleChange}
                error={getError("userName")}
                required
              />

              <EmployeeInput
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                error={getError("password")}
                required
              />
            </div>

            <EmployeeInput
              label="Email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="email"
              error={getError("email")}
              required
            />

            {submitAttempted && Object.keys(errors).length > 0 && (
              <div className="rounded-[7px] border border-red-200 bg-red-50 px-3 py-3 text-[12px] font-semibold text-red-600">
                Please fill out all required fields correctly.
              </div>
            )}
          </div>
        </div>

        <footer className="flex justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-[34px] rounded-[6px] bg-[#F8FAFC] px-4 text-[12px] font-semibold text-[#334155] hover:bg-[#E2E8F0]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="h-[34px] rounded-[6px] bg-[#0097B2] px-5 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
          >
            Save
          </button>
        </footer>
      </section>
    </div>
  );
}

function EmployeeInput({
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  placeholder = "",
  required = false,
}) {
  return (
    <div>
      <label className="mb-2 block text-[12px] font-semibold text-[#64748B]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`h-[38px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
            : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
      />

      {error && (
        <p className="mt-1 text-[11px] font-medium text-red-500">{error}</p>
      )}
    </div>
  );
}

function validateEmployeeForm(data) {
  const errors = {};

  if (!data.name.trim()) {
    errors.name = "Name is required";
  }

  if (!data.userName.trim()) {
    errors.userName = "User name is required";
  }

  if (!data.password.trim()) {
    errors.password = "Password is required";
  } else if (data.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }

  if (!data.email.trim()) {
    errors.email = "Email is required";
  } else if (!isValidEmail(data.email)) {
    errors.email = "Enter a valid email address";
  }

  return errors;
}

function validateField(field, value) {
  if (!value.trim()) {
    if (field === "name") return "Name is required";
    if (field === "userName") return "User name is required";
    if (field === "password") return "Password is required";
    if (field === "email") return "Email is required";
  }

  if (field === "password" && value.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (field === "email" && value && !isValidEmail(value)) {
    return "Enter a valid email address";
  }

  return "";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}