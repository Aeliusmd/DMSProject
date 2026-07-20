"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PersonalPortalDashboardShell from "@/components/personal-request/PersonalPortalDashboardShell";
import {
  getPersonalCurrentUser,
  updatePersonalAccountEmail,
} from "@/lib/personal-request/personalPortalAuthApi";
import {
  clearPersonalAuth,
  isPersonalAuthenticated,
  setPersonalAuth,
} from "@/lib/personal-request/personalPortalAuthStorage";
import { getApiErrorMessage } from "@/lib/apiErrorUtils";

export default function PersonalPortalProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!isPersonalAuthenticated()) {
        router.replace("/personalrequest/login");
        return;
      }

      try {
        const response = await getPersonalCurrentUser();
        if (!active) return;
        const nextUser = response?.data?.user || null;
        setUser(nextUser);
        setEmailDraft(nextUser?.email || "");
      } catch (err) {
        if (!active) return;
        clearPersonalAuth();
        setError(getApiErrorMessage(err, "Unable to load profile"));
        router.replace("/personalrequest/login");
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [router]);

  const handleEmailSave = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const nextEmail = emailDraft.trim().toLowerCase();
    if (!nextEmail) {
      setError("Enter a valid email address");
      return;
    }

    setSaving(true);
    try {
      const response = await updatePersonalAccountEmail(nextEmail);
      const nextUser = response?.data?.user || { ...user, email: nextEmail };
      setUser(nextUser);
      setPersonalAuth({ user: nextUser });
      setMessage(
        response?.data?.message ||
          response?.message ||
          "Email updated. Future notifications will use this address."
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to update email"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PersonalPortalDashboardShell title="Profile">
      <h1 className="mb-5 text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
        Profile
      </h1>

      {error ? (
        <p className="mb-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-[6px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
          {message}
        </p>
      ) : null}

      <section className="max-w-[560px] rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <dl className="space-y-3 text-[13px]">
          <div>
            <dt className="text-[#64748B]">Name</dt>
            <dd className="font-semibold text-[#111827]">
              {user?.displayName ||
                `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
                "—"}
            </dd>
          </div>
        </dl>

        <form onSubmit={handleEmailSave} className="mt-5 space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#334155]">
              Notification email
            </label>
            <input
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              className="h-[42px] w-full rounded-[8px] border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
            />
            <p className="mt-1.5 text-[12px] text-[#94A3B8]">
              Used for sign-in (OTP) and request status updates. Changing this
              also updates email on your linked requests.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving || !emailDraft.trim()}
            className="inline-flex h-10 items-center rounded-[8px] bg-[#0097B2] px-4 text-[13px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
          >
            {saving ? "Saving..." : "Update email"}
          </button>
        </form>
      </section>
    </PersonalPortalDashboardShell>
  );
}
