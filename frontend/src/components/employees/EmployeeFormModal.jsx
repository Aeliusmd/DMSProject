"use client";

import { useState, useMemo } from "react";
import { ApiRequestError } from "@/lib/auth/authApi";
import { mapApiErrors, mergeApiFieldErrors, hasValidationErrors } from "@/lib/apiErrorUtils";
import { validatePersonName } from "@/lib/validations/nameValidation";

const emptyForm = {
  name: "",
  userName: "",
  password: "",
  email: "",
  role: "Employee",
};

export default function EmployeeFormModal({
  open,
  onClose,
  onCreate,
  onUpdate,
  mode = "create",
  employee = null,
}) {
  if (!open) return null;

  return (
    <EmployeeFormModalContent
      onClose={onClose}
      onCreate={onCreate}
      onUpdate={onUpdate}
      mode={mode}
      employee={employee}
    />
  );
}

function EmployeeFormModalContent({ onClose, onCreate, onUpdate, mode, employee }) {
  const isEditMode = mode === "edit";

  const [formData, setFormData] = useState(
    isEditMode && employee
      ? {
          name: employee.name || "",
          userName: employee.logon || "",
          password: "",
          email: employee.email || "",
          role: employee.role || "Employee",
        }
      : emptyForm
  );
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const clientValidationErrors = useMemo(
    () => validateEmployeeForm(formData, isEditMode),
    [formData, isEditMode]
  );
  const isFormInvalid = hasValidationErrors(clientValidationErrors);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (submitAttempted) {
      const fieldError = validateField(name, value, isEditMode);

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

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    setSubmitError("");

    const validationErrors = validateEmployeeForm(formData, isEditMode);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      userName: formData.userName.trim(),
      logon: formData.userName.trim(),
      email: formData.email.trim(),
      role: formData.role,
      ...(formData.password ? { password: formData.password } : {}),
    };

    try {
      if (isEditMode) {
        await onUpdate(payload);
      } else {
        await onCreate({ ...payload, password: formData.password });
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.errors?.length) {
        setErrors((prev) => ({
          ...prev,
          ...mapApiErrors(error.errors, { logon: "userName" }),
        }));
      }

      setSubmitError(
        error.message ||
          (isEditMode ? "Unable to update employee" : "Unable to create employee")
      );
    } finally {
      setIsSubmitting(false);
    }
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
            {isEditMode ? "Edit Employee" : "Employee Information"}
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
                label={isEditMode ? "New Password" : "Password"}
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                error={getError("password")}
                placeholder={isEditMode ? "Leave blank to keep current" : ""}
                required={!isEditMode}
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
            <EmployeeSelect
              label="Role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              error={getError("role")}
              required
            />
            {submitError && (
              <div className="rounded-[7px] border border-red-200 bg-red-50 px-3 py-3 text-[12px] font-semibold text-red-600">
                {submitError}
              </div>
            )}

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
            disabled={isSubmitting || isFormInvalid}
            className="h-[34px] rounded-[6px] bg-[#0097B2] px-5 text-[12px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Saving..."
              : isEditMode
                ? "Edit Employee"
                : "Save"}
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
        className={`h-[38px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${error
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
function EmployeeSelect({
  label,
  name,
  value,
  onChange,
  error,
  required = false,
}) {
  return (
    <div>
      <label className="mb-2 block text-[12px] font-semibold text-[#64748B]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <select
        name={name}
        value={value}
        onChange={onChange}
        className={`h-[38px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none focus:ring-2 ${error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
            : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
          }`}
      >
       
        <option value="Manager">Manager</option>
        <option value="Employee">Employee</option>
      </select>

      {error && (
        <p className="mt-1 text-[11px] font-medium text-red-500">{error}</p>
      )}
    </div>
  );
}

function validateEmployeeForm(data, isEditMode = false) {
  const errors = {};

  if (!data.name.trim()) {
    errors.name = "Name is required";
  } else {
    const nameError = validatePersonName(data.name, { fieldLabel: "Name" });
    if (nameError) errors.name = nameError;
  }

  if (!data.userName.trim()) {
    errors.userName = "User name is required";
  }

  if (!data.password.trim()) {
    // Password is optional when editing (blank keeps the current password).
    if (!isEditMode) {
      errors.password = "Password is required";
    }
  } else if (data.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }

  if (!data.email.trim()) {
    errors.email = "Email is required";
  } else if (!isValidEmail(data.email)) {
    errors.email = "Enter a valid email address";
  }
  if (!data.role) {
    errors.role = "Role is required";
  }
  return errors;
}

function validateField(field, value, isEditMode = false) {
  if (!value.trim()) {
    if (field === "name") return "Name is required";
    if (field === "userName") return "User name is required";
    if (field === "password") return isEditMode ? "" : "Password is required";
    if (field === "email") return "Email is required";
    if (field === "role") return "Role is required";

  }

  if (field === "name" && value) {
    const nameError = validatePersonName(value, { fieldLabel: "Name" });
    if (nameError) return nameError;
  }

  if (field === "password" && value && value.length < 8) {
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