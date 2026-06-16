"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import AlertModal from "@/components/ui/AlertModal";
import {
  createFacilityNote,
  getFacility,
  getFacilityNotes,
} from "@/lib/facilities/facilityApi";

export default function FacilityNotesPage() {
  const params = useParams();
  const facilityId = String(
    params?.facilityId || params?.FacilityId || params?.id || ""
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({
    open: false,
    variant: "success",
    title: "",
    message: "",
  });

  const loadPageData = useCallback(async () => {
    if (!facilityId) return;

    setLoading(true);
    setLoadError("");

    try {
      const [facility, facilityNotes] = await Promise.all([
        getFacility(facilityId),
        getFacilityNotes(facilityId),
      ]);

      setFacilityName(facility?.facilityName || "");
      setNotes(facilityNotes);
    } catch (err) {
      setLoadError(err.message || "Failed to load facility notes");
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const handleNoteChange = (e) => {
    const value = e.target.value.slice(0, 500);
    setNote(value);

    if (error && value.trim()) {
      setError("");
    }
  };

  const handleSave = async () => {
    if (!note.trim()) {
      setError("Note is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const created = await createFacilityNote(facilityId, note.trim());
      setNotes((prev) => [created, ...prev]);
      setNote("");
      setAlert({
        open: true,
        variant: "success",
        title: "Note Saved",
        message: "The facility note was saved successfully.",
      });
    } catch (err) {
      setAlert({
        open: true,
        variant: "error",
        title: "Save Failed",
        message: err.message || "Failed to save note",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex min-h-[calc(100vh-92px)] items-center justify-center text-[13px] text-[#64748B]">
          Loading notes...
        </div>
      </DashboardShell>
    );
  }

  if (loadError) {
    return (
      <DashboardShell>
        <div className="flex min-h-[calc(100vh-92px)] flex-col items-center justify-center gap-4">
          <p className="text-[13px] font-semibold text-red-600">{loadError}</p>
          <Link
            href="/facilities"
            className="text-[12px] font-semibold text-[#007F96] hover:underline"
          >
            Back to Facilities
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex w-full items-center justify-between gap-4">
          <h1 className="text-[18px] font-semibold text-[#111827]">
            {facilityName || "Facility"} - Notes
          </h1>

          <Link
            href="/facilities"
            className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
          >
            <ArrowLeftIcon />
            Facilities
          </Link>
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-5 shadow-sm">
            <h2 className="mb-5 text-[14px] font-semibold text-[#111827]">
              Add Note
            </h2>

            <div className="space-y-5">
              <FacilityInput
                label="Facility"
                value={facilityName}
                disabled
              />

              <div>
                <label className="mb-2 block text-[12px] font-semibold text-[#64748B]">
                  Note <span className="text-red-500">*</span>
                </label>

                <textarea
                  value={note}
                  onChange={handleNoteChange}
                  className={`h-[150px] w-full resize-none rounded-[6px] border bg-white px-3 py-3 text-[12px] leading-[20px] text-[#111827] outline-none focus:ring-2 ${
                    error
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                      : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
                  }`}
                />

                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[11px] font-medium text-red-500">
                    {error}
                  </p>

                  <p className="text-[11px] text-[#94A3B8]">
                    {note.length}/500
                  </p>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex h-[36px] min-w-[74px] items-center justify-center rounded-[6px] bg-[#0097B2] px-5 text-[12px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </section>

          <NotesHistoryTable notes={notes} />
        </div>
      </div>

      <AlertModal
        open={alert.open}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
        onClose={() => setAlert((prev) => ({ ...prev, open: false }))}
      />
    </DashboardShell>
  );
}

function NotesHistoryTable({ notes }) {
  return (
    <section className="min-h-[360px] overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-5 shadow-sm">
      <h2 className="mb-5 text-[14px] font-semibold text-[#111827]">
        Notes History
      </h2>

      <div className="overflow-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead className="bg-[#F8FAFC]">
            <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
              <th className="w-[110px] px-4 py-3">Date</th>
              <th className="w-[130px] px-4 py-3">By</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>

          <tbody>
            {notes.map((item) => (
              <tr
                key={item.id}
                className="border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC]"
              >
                <td className="px-4 py-4 align-top text-[12px] text-[#475569]">
                  {item.date}
                </td>

                <td className="px-4 py-4 align-top text-[12px] text-[#475569]">
                  {item.by}
                </td>

                <td className="px-4 py-4 align-top text-[12px] leading-[20px] text-[#334155]">
                  {item.note}
                </td>
              </tr>
            ))}

            {notes.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-10 text-center text-[12px] text-[#94A3B8]"
                >
                  No notes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FacilityInput({ label, value, disabled = false }) {
  return (
    <div>
      <label className="mb-2 block text-[12px] font-semibold text-[#64748B]">
        {label}
      </label>

      <input
        type="text"
        value={value}
        disabled={disabled}
        readOnly
        className="h-[38px] w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[12px] text-[#111827] outline-none"
      />
    </div>
  );
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
