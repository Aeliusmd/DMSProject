"use client";

import { useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { validatePasswordChangeForm } from "@/lib/passwordValidations";

const initialProfile = {
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@lexflow.com",
};

const initialNotifications = {
  newOrderAlerts: true,
  invoiceReminders: true,
  employeeActivity: true,
  caseStatusUpdates: true,
};

const notificationItems = [
  {
    key: "newOrderAlerts",
    title: "New order alerts",
    description: "Get notified when a new order is created",
  },
  {
    key: "invoiceReminders",
    title: "Invoice reminders",
    description: "Receive alerts for overdue and upcoming invoices",
  },
  {
    key: "employeeActivity",
    title: "Employee activity",
    description: "Track employee actions and changes",
  },
  {
    key: "caseStatusUpdates",
    title: "Case status updates",
    description: "Get notified when case statuses change",
  },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState(initialProfile);
  const [notifications, setNotifications] = useState(initialNotifications);

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;

    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNotificationToggle = (key) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;

    const nextPasswordData = {
      ...passwordData,
      [name]: value,
    };

    setPasswordData(nextPasswordData);

    if (submitAttempted) {
      setErrors(validatePasswordChangeForm(nextPasswordData));
    }
  };

  const handleUpdatePassword = () => {
    setSubmitAttempted(true);

    const validationErrors = validatePasswordChangeForm(passwordData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    console.log("Password update data:", passwordData);

    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    setErrors({});
    setSubmitAttempted(false);
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div>
          <h1 className="text-[18px] font-semibold text-[#111827]">
            Settings
          </h1>

          <p className="mt-1 text-[12px] text-[#64748B]">
            Manage your account and system preferences
          </p>
        </div>

        <div className="flex w-full max-w-[680px] flex-col gap-5">
          <SettingsCard title="Profile Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SettingsField
                label="First Name"
                name="firstName"
                value={profile.firstName}
                onChange={handleProfileChange}
              />

              <SettingsField
                label="Last Name"
                name="lastName"
                value={profile.lastName}
                onChange={handleProfileChange}
              />
            </div>

            <SettingsField
              label="Email"
              name="email"
              type="email"
              value={profile.email}
              onChange={handleProfileChange}
            />
          </SettingsCard>

          <SettingsCard title="Notification Preferences">
            <div className="divide-y divide-[#F1F5F9]">
              {notificationItems.map((item) => (
                <NotificationRow
                  key={item.key}
                  title={item.title}
                  description={item.description}
                  checked={notifications[item.key]}
                  onToggle={() => handleNotificationToggle(item.key)}
                />
              ))}
            </div>
          </SettingsCard>

          <SettingsCard title="Security">
            <div className="space-y-4">
              <SettingsField
                label="Current Password"
                name="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                error={errors.currentPassword}
              />

              <SettingsField
                label="New Password"
                name="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                error={errors.newPassword}
              />

              <SettingsField
                label="Confirm New Password"
                name="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                error={errors.confirmPassword}
              />

              <button
                type="button"
                onClick={handleUpdatePassword}
                className="inline-flex h-[38px] min-w-[132px] items-center justify-center rounded-[6px] bg-[#111827] px-5 text-[12px] font-semibold text-white hover:bg-[#1F2937]"
              >
                Update Password
              </button>
            </div>
          </SettingsCard>
        </div>
      </div>
    </DashboardShell>
  );
}

function SettingsCard({ title, children }) {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-5 shadow-sm">
      <h2 className="mb-5 text-[13px] font-semibold text-[#334155]">
        {title}
      </h2>

      <div className="space-y-4">{children}</div>
    </section>
  );
}

function NotificationRow({ title, description, checked, onToggle }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <h3 className="text-[13px] font-medium text-[#334155]">{title}</h3>

        <p className="mt-1 text-[11px] text-[#94A3B8]">{description}</p>
      </div>

      <ToggleSwitch checked={checked} onChange={onToggle} />
    </div>
  );
}

function SettingsField({
  label,
  name,
  value,
  onChange,
  type = "text",
  error = "",
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold text-[#64748B]">
        {label}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className={`h-[38px] w-full rounded-[6px] border bg-[#F8FAFC] px-3 text-[12px] text-[#111827] outline-none focus:bg-white focus:ring-2 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
            : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
      />

      {error && (
        <p className="mt-1 text-[11px] font-medium text-red-500">{error}</p>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className={`relative h-[18px] w-[34px] shrink-0 rounded-full transition ${
        checked ? "bg-[#0097B2]" : "bg-[#CBD5E1]"
      }`}
    >
      <span
        className={`absolute top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full bg-white shadow-sm transition-all ${
          checked ? "left-[18px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}