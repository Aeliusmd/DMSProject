"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";

const initialFormData = {
  facilityName: "",
  parentCompany: "Smith & Associates",
  userName: "",
  password: "",
  firstName: "",
  middleName: "",
  lastName: "",
  address: "",
  zipCode: "",
  city: "",
  state: "",
  phone: "",
  fax: "",
  email: "",
  ipAddresses: "",
};

const createEmptyManager = () => ({
  firstName: "",
  middleName: "",
  lastName: "",
  phone: "",
  email: "",
});

export default function NewFacilityPage() {
  const router = useRouter();

  const [formData, setFormData] = useState(initialFormData);
  const [managers, setManagers] = useState([createEmptyManager()]);
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    let nextValue = value;

    if (name === "phone" || name === "fax") {
      nextValue = formatPhone(value);
    }

    if (name === "zipCode") {
      nextValue = value.replace(/\D/g, "").slice(0, 5);
    }

    if (name === "state") {
      nextValue = value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));

    if (submitAttempted) {
      const fieldError = validateFacilityField(name, nextValue);

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

  const handleManagerChange = (index, field, value) => {
    let nextValue = value;

    if (field === "phone") {
      nextValue = formatPhone(value);
    }

    setManagers((prev) =>
      prev.map((manager, managerIndex) =>
        managerIndex === index
          ? {
              ...manager,
              [field]: nextValue,
            }
          : manager
      )
    );

    if (submitAttempted) {
      const errorKey = `managers.${index}.${field}`;
      const fieldError = validateManagerField(field, nextValue);

      setErrors((prev) => {
        const nextErrors = { ...prev };

        if (fieldError) {
          nextErrors[errorKey] = fieldError;
        } else {
          delete nextErrors[errorKey];
        }

        return nextErrors;
      });
    }
  };

  const handleAddManager = () => {
    setManagers((prev) => [...prev, createEmptyManager()]);
  };

  const handleRemoveManager = (index) => {
    setManagers((prev) => prev.filter((_, managerIndex) => managerIndex !== index));

    setErrors((prev) => {
      const nextErrors = {};

      Object.entries(prev).forEach(([key, value]) => {
        if (!key.startsWith("managers.")) {
          nextErrors[key] = value;
        }
      });

      return nextErrors;
    });
  };

  const handleSave = () => {
    setSubmitAttempted(true);

    const validationErrors = validateFacilityForm(formData, managers);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    console.log("New facility data:", {
      ...formData,
      managers,
    });

    // Later: call create facility API here
    router.push("/customers");
  };

  const getError = (field) => {
    if (!submitAttempted) return "";
    return errors[field] || "";
  };

  const getManagerError = (index, field) => {
    if (!submitAttempted) return "";
    return errors[`managers.${index}.${field}`] || "";
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[18px] font-semibold text-[#111827]">
            Facility Information
          </h1>

          <Link
            href="/customers"
            className="text-[12px] font-semibold text-[#007F96] hover:underline"
          >
            Facilities
          </Link>
        </div>

        <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-5 shadow-sm">
          <div className="mx-auto w-full max-w-[980px]">
            <div className="space-y-5">
              <h2 className="text-[13px] font-semibold text-[#111827]">
                Facility Information
              </h2>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
                <FacilityField
                  label="Facility Name"
                  name="facilityName"
                  value={formData.facilityName}
                  onChange={handleChange}
                  error={getError("facilityName")}
                  required
                  hint="Please leave blank spaces between numbers, names or words"
                />

                <FacilityField
                  label="Parent Company"
                  name="parentCompany"
                  value={formData.parentCompany}
                  onChange={handleChange}
                  type="select"
                  options={[
                    "Smith & Associates",
                    "Martinez Legal Group",
                    "Pacific Law Partners",
                    "Williams & Co.",
                    "Brown Family Trust",
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FacilityField
                  label="User Name"
                  name="userName"
                  value={formData.userName}
                  onChange={handleChange}
                  error={getError("userName")}
                  required
                />

                <FacilityField
                  label="Password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  type="password"
                  error={getError("password")}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FacilityField
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                />

                <FacilityField
                  label="Middle Name"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleChange}
                />

                <FacilityField
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>

              <FacilityField
                label="Facility Street Address / PO Box"
                name="address"
                value={formData.address}
                onChange={handleChange}
                hint="Please leave blank spaces between numbers, names or words"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-[110px_minmax(0,1fr)_90px]">
                <FacilityField
                  label="Zip Code"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  error={getError("zipCode")}
                  inputMode="numeric"
                />

                <FacilityField
                  label="City"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                />

                <FacilityField
                  label="State"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  error={getError("state")}
                  maxLength={2}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FacilityField
                  label="Phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="XXX-XXX-XXXX"
                  error={getError("phone")}
                  inputMode="numeric"
                />

                <FacilityField
                  label="Fax"
                  name="fax"
                  value={formData.fax}
                  onChange={handleChange}
                  placeholder="XXX-XXX-XXXX"
                  error={getError("fax")}
                  inputMode="numeric"
                />
              </div>

              <FacilityField
                label="Email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="email"
                error={getError("email")}
                required
              />

              <div className="h-px w-full bg-[#E2E8F0]" />

              <div>
                <h3 className="mb-4 text-[13px] font-semibold text-[#111827]">
                  Office Managers
                </h3>

                <div className="space-y-4">
                  {managers.map((manager, index) => (
                    <ManagerSection
                      key={index}
                      manager={manager}
                      index={index}
                      canRemove={managers.length > 1}
                      onChange={handleManagerChange}
                      onRemove={handleRemoveManager}
                      getError={getManagerError}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddManager}
                  className="mt-4 inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] border border-dashed border-[#0097B2] bg-[#E6F7FA]/40 px-4 text-[12px] font-semibold text-[#007F96] hover:bg-[#E6F7FA]"
                >
                  <PlusCircleIcon />
                  Add Manager
                </button>
              </div>

              <FacilityField
                label="IP Addresses"
                name="ipAddresses"
                value={formData.ipAddresses}
                onChange={handleChange}
                textarea
                placeholder="WHITE LIST OF IP ADDRESSES (ONE IP ADDRESS PER LINE)"
                hint="one ip address per line"
              />

              {submitAttempted && Object.keys(errors).length > 0 && (
                <div className="rounded-[7px] border border-red-200 bg-red-50 px-3 py-3 text-[12px] font-semibold text-red-600">
                  Please fill out all required fields correctly.
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex h-[38px] min-w-[74px] items-center justify-center rounded-[6px] bg-[#0097B2] px-5 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function ManagerSection({
  manager,
  index,
  canRemove,
  onChange,
  onRemove,
  getError,
}) {
  return (
    <div className="rounded-[8px] border border-[#E2E8F0] bg-white px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-[11px] font-semibold text-[#64748B]">
          Manager {index + 1}
        </h4>

        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="inline-flex h-[26px] items-center justify-center gap-1 rounded-[5px] border border-red-200 bg-red-50 px-3 text-[10px] font-semibold text-red-500 hover:bg-red-100"
          >
            <TrashIcon />
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FacilityField
          label="First Name"
          name={`manager-${index}-firstName`}
          value={manager.firstName}
          onChange={(e) => onChange(index, "firstName", e.target.value)}
          error={getError(index, "firstName")}
        />

        <FacilityField
          label="Middle Name"
          name={`manager-${index}-middleName`}
          value={manager.middleName}
          onChange={(e) => onChange(index, "middleName", e.target.value)}
          error={getError(index, "middleName")}
        />

        <FacilityField
          label="Last Name"
          name={`manager-${index}-lastName`}
          value={manager.lastName}
          onChange={(e) => onChange(index, "lastName", e.target.value)}
          error={getError(index, "lastName")}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <FacilityField
          label="Phone"
          name={`manager-${index}-phone`}
          value={manager.phone}
          onChange={(e) => onChange(index, "phone", e.target.value)}
          placeholder="XXX-XXX-XXXX"
          error={getError(index, "phone")}
          inputMode="numeric"
        />

        <FacilityField
          label="Email"
          name={`manager-${index}-email`}
          value={manager.email}
          onChange={(e) => onChange(index, "email", e.target.value)}
          error={getError(index, "email")}
        />
      </div>
    </div>
  );
}

function FacilityField({
  label,
  name,
  value,
  onChange,
  error = "",
  type = "text",
  placeholder = "",
  required = false,
  hint = "",
  options = [],
  textarea = false,
  inputMode,
  maxLength,
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold text-[#64748B]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {textarea ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`h-[102px] w-full resize-none rounded-[6px] border bg-white px-3 py-3 text-[12px] leading-[18px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
              : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
          }`}
        />
      ) : type === "select" ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          className="h-[38px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          className={`h-[38px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
              : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
          }`}
        />
      )}

      <div className="mt-1 min-h-[15px]">
        {error ? (
          <p className="text-[11px] font-medium text-red-500">{error}</p>
        ) : hint ? (
          <p className="text-[10px] text-[#94A3B8]">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

function validateFacilityForm(data, managers) {
  const errors = {};

  if (!data.facilityName.trim()) {
    errors.facilityName = "Facility name is required";
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

  if (data.zipCode && data.zipCode.length !== 5) {
    errors.zipCode = "ZIP must be 5 digits";
  }

  if (data.state && data.state.length !== 2) {
    errors.state = "State must be 2 letters";
  }

  if (data.phone && getDigits(data.phone).length !== 10) {
    errors.phone = "Enter a valid 10 digit number";
  }

  if (data.fax && getDigits(data.fax).length !== 10) {
    errors.fax = "Enter a valid 10 digit number";
  }

  managers.forEach((manager, index) => {
    if (manager.phone && getDigits(manager.phone).length !== 10) {
      errors[`managers.${index}.phone`] = "Enter a valid 10 digit number";
    }

    if (manager.email && !isValidEmail(manager.email)) {
      errors[`managers.${index}.email`] = "Enter a valid email address";
    }
  });

  return errors;
}

function validateFacilityField(field, value) {
  if (!value.trim()) {
    if (field === "facilityName") return "Facility name is required";
    if (field === "userName") return "User name is required";
    if (field === "password") return "Password is required";
    if (field === "email") return "Email is required";
  }

  if (field === "password" && value && value.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (field === "email" && value && !isValidEmail(value)) {
    return "Enter a valid email address";
  }

  if (field === "zipCode" && value && value.length !== 5) {
    return "ZIP must be 5 digits";
  }

  if (field === "state" && value && value.length !== 2) {
    return "State must be 2 letters";
  }

  if ((field === "phone" || field === "fax") && value) {
    if (getDigits(value).length !== 10) return "Enter a valid 10 digit number";
  }

  return "";
}

function validateManagerField(field, value) {
  if (field === "email" && value && !isValidEmail(value)) {
    return "Enter a valid email address";
  }

  if (field === "phone" && value && getDigits(value).length !== 10) {
    return "Enter a valid 10 digit number";
  }

  return "";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function getDigits(value) {
  return value.replace(/\D/g, "");
}

function formatPhone(value) {
  const digits = getDigits(value).slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function PlusCircleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 8v8M8 12h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}