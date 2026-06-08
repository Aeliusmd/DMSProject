"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export default function OrderActivityLogModal({ isOpen, order, logs = [], onClose }) {
  const [mounted, setMounted] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setSearchValue("");
  }, [isOpen]);

  const filteredLogs = useMemo(() => {
    const search = searchValue.trim().toLowerCase();

    if (!search) return logs;

    return logs.filter((log) => {
      return (
        log.date.toLowerCase().includes(search) ||
        log.by.toLowerCase().includes(search) ||
        log.callback.toLowerCase().includes(search) ||
        log.note.toLowerCase().includes(search)
      );
    });
  }, [logs, searchValue]);

  if (!mounted || !isOpen || !order) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/45 px-4 py-6 backdrop-blur-[2px]">
      <section className="flex max-h-[calc(100vh-44px)] w-full max-w-[820px] flex-col overflow-hidden rounded-[8px] bg-white shadow-2xl">
        <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[7px] bg-[#E6F7FA] text-[#007F96]">
              <ActivityIcon />
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="truncate text-[13px] font-semibold text-[#111827]">
                  Order Activity Log
                </h2>

                <span className="text-[11px] text-[#64748B]">— {order.id}</span>

                <span className="inline-flex h-[20px] items-center rounded-full bg-[#F1F5F9] px-2 text-[10px] font-semibold text-[#64748B]">
                  {logs.length} entries
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[6px] text-[18px] leading-none text-[#94A3B8] hover:bg-[#E2E8F0] hover:text-[#334155]"
            aria-label="Close activity log"
          >
            ×
          </button>
        </div>

        <div className="shrink-0 border-b border-[#F1F5F9] bg-white px-5 py-4">
          <div className="relative w-full max-w-[310px]">
            <SearchIcon />

            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search activity..."
              className="h-[38px] w-full rounded-[6px] border border-[#CBD5E1] bg-white pl-9 pr-3 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-[#F1F5F9] text-left text-[11px] font-semibold text-[#64748B]">
                <th className="w-[90px] px-5 py-3">Date</th>
                <th className="w-[150px] px-5 py-3">By</th>
                <th className="w-[110px] px-5 py-3">Callback</th>
                <th className="px-5 py-3">Note</th>
              </tr>
            </thead>

            <tbody>
              {filteredLogs.map((log, index) => (
                <tr
                  key={`${log.date}-${index}`}
                  className="border-b border-[#F8FAFC] text-[12px] text-[#334155] last:border-b-0 odd:bg-white even:bg-[#FCFEFF] hover:bg-[#F8FBFC]"
                >
                  <td className="px-5 py-4 align-top text-[#475569]">
                    {log.date}
                  </td>

                  <td className="px-5 py-4 align-top font-semibold text-[#111827]">
                    {log.by}
                  </td>

                  <td className="px-5 py-4 align-top text-[#CBD5E1]">
                    {log.callback || "–"}
                  </td>

                  <td className="px-5 py-4 align-top leading-[18px] text-[#334155]">
                    {renderNote(log.note)}
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-14 text-center text-[13px] text-[#94A3B8]"
                  >
                    No activity logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 border-t border-[#F1F5F9] bg-white px-5 py-3">
          <p className="text-[11px] text-[#94A3B8]">
            Showing {filteredLogs.length} of {logs.length} entries
          </p>
        </div>
      </section>
    </div>,
    document.body
  );
}

function renderNote(note) {
  const parts = String(note).split(/(CNR Letter|Copy Service Letter)/g);

  return parts.map((part, index) => {
    if (part === "CNR Letter" || part === "Copy Service Letter") {
      return (
        <span key={index} className="font-semibold text-[#2563EB]">
          {part}
        </span>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

function ActivityIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8v5l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 12a8 8 0 1 0 2.35-5.65"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 4v5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m20 20-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}