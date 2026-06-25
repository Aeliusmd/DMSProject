"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/authApi";
import { getOrderReminders } from "@/lib/orders/orderApi";
import { filterReminders } from "@/lib/orders/reminderFilters";
import OrderNotesModal from "@/components/orders/OrderNotesModal";

const EMPTY_FILTERS = {
  orderId: "",
  performedBy: "",
};

export default function ReminderNotesModal({ isOpen, onClose }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("my");
  const [currentUser, setCurrentUser] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  const isAdmin =
    String(currentUser?.role || "").toLowerCase() === "admin";

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setLoading(true);
    setLoadError("");

    (async () => {
      try {
        const user = await getCurrentUser();
        if (!active) return;
        setCurrentUser(user);

        const scope =
          activeTab === "all" &&
          String(user?.role || "").toLowerCase() === "admin"
            ? "all"
            : "my";
        const data = await getOrderReminders(scope);
        if (!active) return;
        setReminders(data);
      } catch (error) {
        if (!active) return;
        setReminders([]);
        setLoadError(error.message || "Failed to load reminders");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedReminder(null);
      setFilters(EMPTY_FILTERS);
      setAppliedFilters(EMPTY_FILTERS);
    }
  }, [isOpen]);

  const filteredReminders = useMemo(
    () => filterReminders(reminders, appliedFilters),
    [reminders, appliedFilters]
  );

  const performerOptions = useMemo(() => {
    const names = new Set();

    reminders.forEach((reminder) => {
      const name = String(reminder.by || "").trim();
      if (name && name !== "—") {
        names.add(name);
      }
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [reminders]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      orderId: filters.orderId.trim(),
      performedBy: filters.performedBy.trim(),
    });
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  if (!isOpen) return null;

  const openOrderForEdit = (orderId) => {
    if (!orderId) return;
    onClose?.();
    router.push(`/orders/new?mode=edit&orderId=${encodeURIComponent(orderId)}`);
  };

  const refreshReminders = () => {
    const scope = activeTab === "all" && isAdmin ? "all" : "my";
    getOrderReminders(scope)
      .then(setReminders)
      .catch(() => {});
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
            onClick={() => setActiveTab("my")}
            className={`rounded-[8px] px-5 py-3 text-[14px] font-semibold transition ${
              activeTab === "my"
                ? "bg-[#E6F7FA] text-[#007F96]"
                : "text-[#64748B] hover:bg-[#F8FAFC]"
            }`}
          >
            My Reminders
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded-[8px] px-5 py-3 text-[14px] font-semibold transition ${
                activeTab === "all"
                  ? "bg-[#E6F7FA] text-[#007F96]"
                  : "text-[#64748B] hover:bg-[#F8FAFC]"
              }`}
            >
              All Reminders
            </button>
          )}
        </div>

        <ReminderFilters
          filters={filters}
          performerOptions={performerOptions}
          resultCount={filteredReminders.length}
          totalCount={reminders.length}
          onChange={handleFilterChange}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          <ReminderTable
            reminders={filteredReminders}
            loading={loading}
            error={loadError}
            emptyMessage={
              appliedFilters.orderId || appliedFilters.performedBy
                ? "No reminders match your filters."
                : "No reminders found."
            }
            onOrderClick={openOrderForEdit}
            onDateClick={(reminder) => setSelectedReminder(reminder)}
          />

          <div className="shrink-0 border-t border-[#E2E8F0] px-5 py-4">
            <button
              type="button"
              disabled
              className="cursor-not-allowed text-[14px] font-semibold text-[#94A3B8]"
            >
              Add a note (disabled here)
            </button>
          </div>
        </div>
      </section>

      <OrderNotesModal
        isOpen={Boolean(selectedReminder)}
        order={
          selectedReminder
            ? {
                id:
                  selectedReminder.orderNumber ||
                  selectedReminder.caseNumber,
                dbId: selectedReminder.orderId,
                applicant: selectedReminder.applicant,
              }
            : null
        }
        initialNoteId={selectedReminder?.noteId || null}
        disableCreate
        includeCalled
        singleNoteMode
        onClose={() => {
          setSelectedReminder(null);
          refreshReminders();
        }}
      />
    </div>
  );
}

function ReminderFilters({
  filters,
  performerOptions,
  resultCount,
  totalCount,
  onChange,
  onApply,
  onReset,
}) {
  const hasActiveFilters =
    Boolean(filters.orderId.trim()) || Boolean(filters.performedBy.trim());

  return (
    <div className="shrink-0 border-b border-[#E2E8F0] px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <FilterField
          label="Order ID"
          name="orderId"
          value={filters.orderId}
          onChange={onChange}
          placeholder="Enter order number"
        />

        <FilterField
          label="Performed By"
          name="performedBy"
          value={filters.performedBy}
          onChange={onChange}
          placeholder="Enter user name"
          listId="reminder-performer-options"
        />

        <datalist id="reminder-performer-options">
          {performerOptions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <button
          type="button"
          onClick={onApply}
          className="h-[38px] whitespace-nowrap rounded-[6px] bg-[#0097B2] px-5 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
        >
          Apply Filters
        </button>

        <button
          type="button"
          onClick={onReset}
          className="h-[38px] whitespace-nowrap rounded-[6px] bg-[#F1F5F9] px-5 text-[12px] font-semibold text-[#334155] hover:bg-[#E2E8F0]"
        >
          Reset
        </button>
      </div>

      {hasActiveFilters && (
        <p className="mt-3 text-[12px] text-[#64748B]">
          Showing {resultCount} of {totalCount} reminder
          {totalCount === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

function FilterField({
  label,
  name,
  value,
  onChange,
  placeholder = "",
  listId,
}) {
  return (
    <div className="min-w-0 flex-1 lg:max-w-[200px]">
      <label className="mb-2 block text-[11px] font-medium text-[#64748B]">
        {label}
      </label>

      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        list={listId}
        className="h-[38px] w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
      />
    </div>
  );
}

function ReminderTable({
  reminders,
  loading,
  error,
  emptyMessage = "No reminders found.",
  onOrderClick,
  onDateClick,
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-[#E2E8F0] text-left text-[12px] font-semibold text-[#64748B]">
            <th className="w-[130px] px-5 py-3">Order</th>
            <th className="w-[170px] px-5 py-3">Date</th>
            <th className="w-[160px] px-5 py-3">By</th>
            <th className="px-5 py-3">Note</th>
          </tr>
        </thead>

        <tbody>
          {loading && (
            <tr>
              <td
                colSpan={4}
                className="px-5 py-12 text-center text-[14px] text-[#94A3B8]"
              >
                Loading reminders...
              </td>
            </tr>
          )}

          {!loading && error && (
            <tr>
              <td
                colSpan={4}
                className="px-5 py-12 text-center text-[14px] font-semibold text-red-500"
              >
                {error}
              </td>
            </tr>
          )}

          {!loading &&
            !error &&
            reminders.map((reminder) => (
              <tr
                key={reminder.noteId}
                className="border-b border-[#F1F5F9] transition hover:bg-[#F8FAFC]"
              >
                <td className="px-5 py-5 align-top">
                  <button
                    type="button"
                    onClick={() => onOrderClick(reminder.orderId)}
                    className="text-[14px] font-semibold text-[#2563EB] underline"
                  >
                    {reminder.orderNumber || reminder.caseNumber}
                  </button>
                </td>

                <td className="px-5 py-5 align-top text-[14px] text-[#334155]">
                  <button
                    type="button"
                    onClick={() => onDateClick(reminder)}
                    className="font-medium text-[#007F96] underline"
                  >
                    {reminder.date}
                  </button>
                </td>

                <td className="px-5 py-5 align-top text-[14px] text-[#334155]">
                  {reminder.by}
                </td>

                <td className="px-5 py-5 align-top">
                  <p className="max-w-[620px] text-[14px] leading-[22px] text-[#334155]">
                    {reminder.note}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                    <span
                      className={`rounded-[6px] px-2.5 py-0.5 text-[11px] font-semibold ${
                        reminder.isCalled
                          ? "bg-[#ECFDF5] text-[#059669]"
                          : "bg-[#FEF2F2] text-[#DC2626]"
                      }`}
                    >
                      {reminder.isCalled ? "Callbacked" : "Not Callbacked"}
                    </span>

                    <span className="font-semibold text-[#64748B]">
                      Callback Date:
                    </span>
                    <span className="font-semibold text-red-500">
                      {reminder.callbackDateDisplay ||
                        reminder.callbackDate ||
                        "—"}
                    </span>
                  </div>
                </td>
              </tr>
            ))}

          {!loading && !error && reminders.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-5 py-12 text-center text-[14px] text-[#94A3B8]"
              >
                {emptyMessage}
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
