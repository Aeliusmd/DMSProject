"use client";

import { useMemo, useState } from "react";

import {
  formatDateForDisplay,
  getCurrentReminderDate,
  getEmptyReminderForm,
  getNextReminderId,
  toDateInputValue,
  validateReminderField,
  validateReminderForm,
} from "@/lib/validations/reminderValidation";

const currentUser = "John Doe";

const reminderSeed = [
  {
    id: 185,
    caseNumber: "66364-2",
    date: "11/20/25 02:05PM",
    by: "Matthew Perera",
    assignedTo: "John Doe",
    note: "Client called regarding missing forms. Requested callback to clarify which I-864 variant is needed.",
    applicant: "Yaretta Robinson",
    callbackDate: "11/22/25",
  },
  {
    id: 187,
    caseNumber: "66365-1",
    date: "11/18/25 10:30AM",
    by: "Sarah Johnson",
    assignedTo: "John Doe",
    note: "Awaiting additional financial affidavit. Client needs follow-up call to confirm receipt.",
    applicant: "Michael Anderson",
    callbackDate: "11/20/25",
  },
  {
    id: 189,
    caseNumber: "66366-3",
    date: "11/15/25 03:15PM",
    by: "John Doe",
    assignedTo: "John Doe",
    note: "Annual compliance check due. Client requested a callback to discuss updated state filing requirements.",
    applicant: "Rebecca Chen",
    callbackDate: "11/18/25",
  },
  {
    id: 193,
    caseNumber: "66367-2",
    date: "11/12/25 09:45AM",
    by: "Matthew Perera",
    assignedTo: "Matthew Perera",
    note: "Pre-trial conference scheduled. Need to confirm witness list and discuss plea options.",
    applicant: "Daniel Smith",
    callbackDate: "11/14/25",
  },
  {
    id: 195,
    caseNumber: "66368-1",
    date: "11/10/25 11:20AM",
    by: "Sarah Johnson",
    assignedTo: "Sarah Johnson",
    note: "Trust document amendments pending. Client requested callback to review changes.",
    applicant: "Laura Mitchell",
    callbackDate: "11/12/25",
  },
  {
    id: 197,
    caseNumber: "66369-4",
    date: "11/08/25 01:50PM",
    by: "John Doe",
    assignedTo: "John Doe",
    note: "Settlement offer received. Client needs time to review. Callback scheduled for decision.",
    applicant: "Robert Brown",
    callbackDate: "11/10/25",
  },
  {
    id: 199,
    caseNumber: "66370-2",
    date: "11/05/25 04:30PM",
    by: "Emily Davis",
    assignedTo: "Emily Davis",
    note: "Mediation scheduled for next week. Client needs prep call regarding asset division.",
    applicant: "Angela Davis",
    callbackDate: "11/08/25",
  },
  {
    id: 201,
    caseNumber: "66371-1",
    date: "11/03/25 08:10AM",
    by: "Matthew Perera",
    assignedTo: "Matthew Perera",
    note: "Counter-offer received from opposing counsel. Client needs callback to discuss strategy.",
    applicant: "Peter Wilson",
    callbackDate: "11/05/25",
  },
  {
    id: 203,
    caseNumber: "66372-3",
    date: "11/01/25 02:40PM",
    by: "Sarah Johnson",
    assignedTo: "Sarah Johnson",
    note: "Discovery deadline approaching. Client needs callback to review document production.",
    applicant: "Nancy Taylor",
    callbackDate: "11/03/25",
  },
  {
    id: 207,
    caseNumber: "66373-2",
    date: "10/28/25 11:15AM",
    by: "John Doe",
    assignedTo: "John Doe",
    note: "USPTO response deadline. Client needs callback to confirm filing strategy.",
    applicant: "Kevin Lee",
    callbackDate: "10/30/25",
  },
];

export default function ReminderNotesModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("my");
  const [reminders, setReminders] = useState(reminderSeed);

  const [mode, setMode] = useState(null);
  const [selectedReminderId, setSelectedReminderId] = useState(null);
  const [formData, setFormData] = useState(getEmptyReminderForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const filteredReminders = useMemo(() => {
    if (activeTab === "my") {
      return reminders.filter((item) => item.assignedTo === currentUser);
    }

    return reminders;
  }, [activeTab, reminders]);

  if (!isOpen) return null;

  const selectedReminder = reminders.find(
    (item) => item.id === selectedReminderId
  );

  const isFormOpen = mode === "edit" || mode === "add";

  const resetFormState = () => {
    setMode(null);
    setSelectedReminderId(null);
    setFormData(getEmptyReminderForm());
    setFormErrors({});
    setSubmitAttempted(false);
  };

  const handleSelectReminder = (reminder) => {
    setMode("edit");
    setSelectedReminderId(reminder.id);
    setSubmitAttempted(false);
    setFormErrors({});

    setFormData({
      caseNumber: reminder.caseNumber,
      applicant: reminder.applicant,
      note: reminder.note,
      callbackDate: toDateInputValue(reminder.callbackDate),
      attachment: null,
    });
  };

  const handleAddNote = () => {
    setMode("add");
    setSelectedReminderId(null);
    setSubmitAttempted(false);
    setFormErrors({});
    setFormData(getEmptyReminderForm());
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    resetFormState();
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (submitAttempted) {
      const fieldError = validateReminderField(field, value);

      setFormErrors((prev) => {
        const nextErrors = { ...prev };

        if (fieldError) {
          nextErrors[field] = fieldError;
        } else {
          delete nextErrors[field];
        }

        return nextErrors;
      });
    }
  };

  const handleSave = () => {
    setSubmitAttempted(true);

    const errors = validateReminderForm(formData);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) return;

    if (mode === "edit" && selectedReminder) {
      const updatedReminder = {
        ...selectedReminder,
        caseNumber: formData.caseNumber.trim(),
        applicant: formData.applicant.trim(),
        note: formData.note.trim(),
        callbackDate: formatDateForDisplay(formData.callbackDate),
      };

      setReminders((prev) =>
        prev.map((item) =>
          item.id === selectedReminder.id ? updatedReminder : item
        )
      );

      console.log("Updated reminder:", {
        ...updatedReminder,
        attachment: formData.attachment,
      });

      return;
    }

    if (mode === "add") {
      const newReminder = {
        id: getNextReminderId(reminders),
        caseNumber: formData.caseNumber.trim(),
        date: getCurrentReminderDate(),
        by: currentUser,
        assignedTo: currentUser,
        note: formData.note.trim(),
        applicant: formData.applicant.trim(),
        callbackDate: formatDateForDisplay(formData.callbackDate),
      };

      setReminders((prev) => [newReminder, ...prev]);

      console.log("Added reminder:", {
        ...newReminder,
        attachment: formData.attachment,
      });

      setMode("edit");
      setSelectedReminderId(newReminder.id);
      setFormData({
        caseNumber: newReminder.caseNumber,
        applicant: newReminder.applicant,
        note: newReminder.note,
        callbackDate: toDateInputValue(newReminder.callbackDate),
        attachment: null,
      });
      setFormErrors({});
      setSubmitAttempted(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex h-[min(880px,92vh)] w-full max-w-[1240px] flex-col overflow-hidden rounded-[12px] bg-white shadow-2xl">
        <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-[#E2E8F0] px-5">
          <h2 className="text-[16px] font-semibold text-[#111827]">
            DMS Custodian - Note
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-[32px] w-[32px] items-center justify-center rounded-[6px] text-[#64748B] hover:bg-[#F8FAFC]"
            aria-label="Close reminder modal"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-[#E2E8F0] px-5">
          <button
            type="button"
            onClick={() => handleTabChange("my")}
            className={`rounded-[8px] px-5 py-3 text-[14px] font-semibold transition ${
              activeTab === "my"
                ? "bg-[#E6F7FA] text-[#007F96]"
                : "text-[#64748B] hover:bg-[#F8FAFC]"
            }`}
          >
            My Reminders
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={`rounded-[8px] px-5 py-3 text-[14px] font-semibold transition ${
              activeTab === "all"
                ? "bg-[#E6F7FA] text-[#007F96]"
                : "text-[#64748B] hover:bg-[#F8FAFC]"
            }`}
          >
            All Reminders
          </button>
        </div>

        <div
          className={`grid min-h-0 flex-1 ${
            isFormOpen
              ? "grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)]"
              : "grid-cols-1"
          }`}
        >
          {isFormOpen && (
            <ReminderFormPanel
              mode={mode}
              formData={formData}
              formErrors={formErrors}
              submitAttempted={submitAttempted}
              onFieldChange={handleFieldChange}
              onCancel={resetFormState}
              onSave={handleSave}
            />
          )}

          <div className="flex min-h-0 flex-col">
            <ReminderTable
              reminders={filteredReminders}
              selectedReminderId={selectedReminderId}
              onSelect={handleSelectReminder}
            />

            <div className="shrink-0 border-t border-[#E2E8F0] px-5 py-4">
              <button
                type="button"
                onClick={handleAddNote}
                className="text-[14px] font-semibold text-[#64748B] hover:text-[#0097B2]"
              >
                Add a note
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ReminderFormPanel({
  mode,
  formData,
  formErrors,
  submitAttempted,
  onFieldChange,
  onCancel,
  onSave,
}) {
  const title = mode === "add" ? "Add Note" : "Edit Note";

  const getError = (field) => {
    if (!submitAttempted) return "";
    return formErrors[field] || "";
  };

  return (
    <aside className="flex min-h-0 flex-col border-b border-[#E2E8F0] bg-[#F8FAFC] lg:border-b-0 lg:border-r">
      <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
        <h3 className="text-[15px] font-semibold text-[#111827]">{title}</h3>

        <button
          type="button"
          onClick={onCancel}
          className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] text-[#64748B] hover:bg-white"
          aria-label="Close form"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-5">
          <ReminderInput
            label="Case #"
            value={formData.caseNumber}
            onChange={(value) => onFieldChange("caseNumber", value)}
            error={getError("caseNumber")}
            placeholder="Enter case number"
          />

          <ReminderInput
            label="Applicant"
            value={formData.applicant}
            onChange={(value) => onFieldChange("applicant", value)}
            error={getError("applicant")}
            placeholder="Enter applicant name"
          />

          <div>
            <label className="mb-2 block text-[12px] font-semibold text-[#64748B]">
              Note <span className="text-red-500">*</span>
            </label>

            <textarea
              value={formData.note}
              onChange={(e) =>
                onFieldChange("note", e.target.value.slice(0, 500))
              }
              rows={6}
              placeholder="Enter note"
              className={`w-full resize-none rounded-[7px] border bg-white px-4 py-3 text-[14px] leading-[22px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
                getError("note")
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                  : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
              }`}
            />

            <div className="mt-1 flex items-center justify-between">
              <p className="text-[11px] font-medium text-red-500">
                {getError("note")}
              </p>
              <p className="text-[11px] text-[#94A3B8]">
                {formData.note.length}/500
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-[12px] font-semibold text-[#64748B]">
                Callback <span className="text-red-500">*</span>
              </label>

              <button
                type="button"
                className="text-[11px] font-semibold text-[#0097B2]"
              >
                called
              </button>
            </div>

            <input
              type="date"
              value={formData.callbackDate}
              onChange={(e) => onFieldChange("callbackDate", e.target.value)}
              className={`h-[42px] w-full rounded-[7px] border bg-white px-4 text-[14px] text-[#111827] outline-none focus:ring-2 ${
                getError("callbackDate")
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                  : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
              }`}
            />

            {getError("callbackDate") && (
              <p className="mt-1 text-[11px] font-medium text-red-500">
                {getError("callbackDate")}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-semibold text-[#64748B]">
              Attach
            </label>

            <input
              type="file"
              onChange={(e) =>
                onFieldChange("attachment", e.target.files?.[0] || null)
              }
              className="block w-full text-[12px] text-[#64748B] file:mr-3 file:rounded-[6px] file:border file:border-[#CBD5E1] file:bg-white file:px-4 file:py-2 file:text-[12px] file:font-medium file:text-[#334155]"
            />
          </div>

          {submitAttempted && Object.keys(formErrors).length > 0 && (
            <div className="rounded-[7px] border border-red-200 bg-red-50 px-3 py-3 text-[12px] font-semibold text-red-600">
              Please fill out all required fields.
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-[44px] flex-1 rounded-[7px] border border-[#E2E8F0] bg-white text-[14px] font-semibold text-[#334155] hover:bg-[#F8FAFC]"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onSave}
          className="h-[44px] flex-1 rounded-[7px] bg-[#0097B2] text-[14px] font-semibold text-white hover:bg-[#0086A0]"
        >
          Save
        </button>
      </div>
    </aside>
  );
}

function ReminderInput({ label, value, onChange, error, placeholder }) {
  return (
    <div>
      <label className="mb-2 block text-[12px] font-semibold text-[#64748B]">
        {label} <span className="text-red-500">*</span>
      </label>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-[42px] w-full rounded-[7px] border bg-white px-4 text-[14px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
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

function ReminderTable({ reminders, selectedReminderId, onSelect }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-[#E2E8F0] text-left text-[12px] font-semibold text-[#64748B]">
            <th className="w-[110px] px-5 py-3">Case</th>
            <th className="w-[170px] px-5 py-3">Date</th>
            <th className="w-[160px] px-5 py-3">By</th>
            <th className="px-5 py-3">Note</th>
          </tr>
        </thead>

        <tbody>
          {reminders.map((reminder) => (
            <tr
              key={reminder.id}
              onClick={() => onSelect(reminder)}
              className={`cursor-pointer border-b border-[#F1F5F9] transition hover:bg-[#F8FAFC] ${
                selectedReminderId === reminder.id ? "bg-[#F8FAFC]" : ""
              }`}
            >
              <td className="px-5 py-5 align-top">
                <span className="text-[14px] font-medium text-[#2563EB]">
                  {reminder.caseNumber}
                </span>
              </td>

              <td className="px-5 py-5 align-top text-[14px] text-[#334155]">
                {reminder.date}
              </td>

              <td className="px-5 py-5 align-top text-[14px] text-[#334155]">
                {reminder.by}
              </td>

              <td className="px-5 py-5 align-top">
                <p className="max-w-[620px] text-[14px] leading-[22px] text-[#334155]">
                  {reminder.note}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-semibold text-[#64748B]">
                    Callback Date:
                  </span>
                  <span className="font-semibold text-red-500">
                    {reminder.callbackDate}
                  </span>
                  <span className="rounded-[6px] bg-red-500 px-3 py-1 text-[12px] font-semibold text-white">
                    {reminder.id}
                  </span>
                </div>
              </td>
            </tr>
          ))}

          {reminders.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-5 py-12 text-center text-[14px] text-[#94A3B8]"
              >
                No reminders found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}