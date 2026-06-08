"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";

const initialFormData = {
  firstName: "",
  lastName: "",
  email: "",
  role: "User",
  job: "Attorney",

  authorizedFrom: "08:00",
  authorizedThrough: "18:00",

  days: {
    Mon: true,
    Tue: true,
    Wed: true,
    Thu: true,
    Fri: true,
    Sat: true,
  },

  dayTimes: {
    Mon: "08:00-18:00",
    Tue: "08:00-18:00",
    Wed: "08:00-18:00",
    Thu: "08:00-18:00",
    Fri: "08:00-18:00",
    Sat: "09:00-13:00",
  },

  userLogon: "",
  password: "",
  sameAsEmail: false,
};

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function NewCustomerUserPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = getCustomerIdFromParams(params);

  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    const nextFormData = {
      ...formData,
      [name]: value,
    };

    if (name === "email" && formData.sameAsEmail) {
      nextFormData.userLogon = value;
    }

    setFormData(nextFormData);

    if (submitAttempted) {
      setErrors(validateUserForm(nextFormData));
    }
  };

  const handleSameAsEmailChange = (e) => {
    const checked = e.target.checked;

    const nextFormData = {
      ...formData,
      sameAsEmail: checked,
      userLogon: checked ? formData.email : formData.userLogon,
    };

    setFormData(nextFormData);

    if (submitAttempted) {
      setErrors(validateUserForm(nextFormData));
    }
  };

  const handleDayToggle = (day) => {
    const nextFormData = {
      ...formData,
      days: {
        ...formData.days,
        [day]: !formData.days[day],
      },
    };

    setFormData(nextFormData);

    if (submitAttempted) {
      setErrors(validateUserForm(nextFormData));
    }
  };

  const handleDayTimeChange = (day, value) => {
    const cleanedValue = sanitizeTimeRange(value);

    const nextFormData = {
      ...formData,
      dayTimes: {
        ...formData.dayTimes,
        [day]: cleanedValue,
      },
    };

    setFormData(nextFormData);

    if (submitAttempted) {
      setErrors(validateUserForm(nextFormData));
    }
  };

  const handleSave = () => {
    setSubmitAttempted(true);

    const validationErrors = validateUserForm(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    console.log("New customer user:", {
      customerId,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      role: formData.role,
      job: formData.job,
      authorizedFrom: formData.authorizedFrom,
      authorizedThrough: formData.authorizedThrough,
      days: formData.days,
      dayTimes: formData.dayTimes,
      userLogon: formData.userLogon.trim(),
      password: formData.password,
    });

    router.push(`/customers/${customerId}/users`);
  };

  const getError = (field) => {
    if (!submitAttempted) return "";
    return errors[field] || "";
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[18px] font-semibold text-[#111827]">
            User Information
          </h1>

          <Link
            href={`/customers/${customerId}/users`}
            className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
          >
            <ArrowLeftIcon />
            Users
          </Link>
        </div>

        <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-6 shadow-sm">
          <div className="w-full max-w-[860px]">
            <UserSection title="Basic Info">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <UserField
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  error={getError("firstName")}
                  required
                />

                <UserField
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  error={getError("lastName")}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_110px_150px]">
                <UserField
                  label="Email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  error={getError("email")}
                  required
                />

                <UserField
                  label="Role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  type="select"
                  options={["User", "Manager", "Admin"]}
                />

                <UserField
                  label="Job"
                  name="job"
                  value={formData.job}
                  onChange={handleChange}
                  type="select"
                  options={[
                    "Attorney",
                    "Partner",
                    "Office Manager",
                    "Legal Assistant",
                    "Paralegal",
                    "Records Clerk",
                  ]}
                />
              </div>
            </UserSection>

            <div className="mt-10 border-t border-[#E2E8F0] pt-10">
              <UserSection title="Authorized Times">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <UserField
                    label="Authorized Times From"
                    name="authorizedFrom"
                    value={formData.authorizedFrom}
                    onChange={handleChange}
                    type="time"
                    error={getError("authorizedFrom")}
                  />

                  <UserField
                    label="Through"
                    name="authorizedThrough"
                    value={formData.authorizedThrough}
                    onChange={handleChange}
                    type="time"
                    error={getError("authorizedThrough")}
                  />
                </div>

                <div>
                  <p className="mb-3 text-[11px] font-semibold text-[#64748B]">
                    Days of Week
                  </p>

                  <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {weekDays.map((day) => {
                        const dayError = getError(`dayTimes.${day}`);

                        return (
                          <div key={day} className="min-w-0">
                            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#334155]">
                              <input
                                type="checkbox"
                                checked={formData.days[day]}
                                onChange={() => handleDayToggle(day)}
                                className="h-[13px] w-[13px] rounded border-[#CBD5E1] accent-[#3B82F6]"
                              />
                              {day}
                            </label>

                            <input
                              type="text"
                              value={formData.dayTimes[day]}
                              onChange={(e) =>
                                handleDayTimeChange(day, e.target.value)
                              }
                              disabled={!formData.days[day]}
                              placeholder="08:00-18:00"
                              className={`mt-2 h-[32px] w-full rounded-[5px] border bg-white px-2 text-[11px] text-[#111827] outline-none disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8] ${
                                dayError
                                  ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
                                  : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
                              }`}
                            />

                            {dayError && (
                              <p className="mt-1 text-[10px] font-medium text-red-500">
                                {dayError}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {getError("days") && (
                      <p className="mt-3 text-[11px] font-medium text-red-500">
                        {getError("days")}
                      </p>
                    )}
                  </div>
                </div>
              </UserSection>
            </div>

            <div className="mt-10 border-t border-[#E2E8F0] pt-10">
              <UserSection title="Login Credentials">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <UserField
                    label="User Logon"
                    name="userLogon"
                    value={formData.userLogon}
                    onChange={handleChange}
                    error={getError("userLogon")}
                    required
                    disabled={formData.sameAsEmail}
                  />

                  <UserField
                    label="Password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    type="password"
                    error={getError("password")}
                    required
                  />
                </div>

                <label className="flex items-center gap-2 pt-1 text-[12px] text-[#475569]">
                  <input
                    type="checkbox"
                    checked={formData.sameAsEmail}
                    onChange={handleSameAsEmailChange}
                    className="h-[13px] w-[13px] rounded border-[#CBD5E1] accent-[#0097B2]"
                  />
                  click to make Logon same as Email Address
                </label>
              </UserSection>
            </div>

            {submitAttempted && Object.keys(errors).length > 0 && (
              <div className="mt-6 rounded-[7px] border border-red-200 bg-red-50 px-3 py-3 text-[12px] font-semibold text-red-600">
                Please fill out all required fields correctly.
              </div>
            )}

            <div className="mt-6">
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex h-[38px] min-w-[74px] items-center justify-center rounded-[6px] bg-[#0097B2] px-5 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
              >
                Save
              </button>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function UserSection({ title, children }) {
  return (
    <div>
      <h2 className="mb-7 text-[15px] font-semibold text-[#111827]">
        {title}
      </h2>

      <div className="space-y-6">{children}</div>
    </div>
  );
}

function UserField({
  label,
  name,
  value,
  onChange,
  error = "",
  type = "text",
  required = false,
  options = [],
  disabled = false,
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold text-[#64748B]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {type === "select" ? (
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
          disabled={disabled}
          className={`h-[38px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-[#F8FAFC] ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
              : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
          }`}
        />
      )}

      {error && (
        <p className="mt-1 text-[11px] font-medium text-red-500">{error}</p>
      )}
    </div>
  );
}

function validateUserForm(data) {
  const errors = {};

  if (!data.firstName.trim()) {
    errors.firstName = "First name is required";
  }

  if (!data.lastName.trim()) {
    errors.lastName = "Last name is required";
  }

  if (!data.email.trim()) {
    errors.email = "Email is required";
  } else if (!isValidEmail(data.email)) {
    errors.email = "Enter a valid email address";
  }

  if (!data.authorizedFrom) {
    errors.authorizedFrom = "Start time is required";
  }

  if (!data.authorizedThrough) {
    errors.authorizedThrough = "End time is required";
  }

  if (
    data.authorizedFrom &&
    data.authorizedThrough &&
    !isStartBeforeEnd(data.authorizedFrom, data.authorizedThrough)
  ) {
    errors.authorizedThrough = "End time must be after start time";
  }

  const hasSelectedDay = Object.values(data.days).some(Boolean);

  if (!hasSelectedDay) {
    errors.days = "Select at least one day";
  }

  weekDays.forEach((day) => {
    if (!data.days[day]) return;

    const value = data.dayTimes[day];

    if (!value.trim()) {
      errors[`dayTimes.${day}`] = "Time range is required";
      return;
    }

    if (!isValidTimeRange(value)) {
      errors[`dayTimes.${day}`] = "Use HH:MM-HH:MM";
      return;
    }

    const [start, end] = value.split("-");

    if (!isStartBeforeEnd(start, end)) {
      errors[`dayTimes.${day}`] = "End must be after start";
    }
  });

  if (!data.userLogon.trim()) {
    errors.userLogon = "User logon is required";
  }

  if (!data.password.trim()) {
    errors.password = "Password is required";
  } else if (data.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }

  return errors;
}

function sanitizeTimeRange(value) {
  return value.replace(/[^0-9:-]/g, "").slice(0, 11);
}

function isValidTimeRange(value) {
  return /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isStartBeforeEnd(start, end) {
  return timeToMinutes(start) < timeToMinutes(end);
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function getCustomerIdFromParams(params) {
  const rawId =
    params?.customerId ||
    params?.id ||
    params?.customer ||
    params?.customerID ||
    "1";

  const value = Array.isArray(rawId) ? rawId[0] : rawId;
  const parsedId = Number(value);

  return Number.isNaN(parsedId) ? 1 : parsedId;
}

function ArrowLeftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M19 12H5M11 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}