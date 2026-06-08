"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import ActivityLogTable from "@/components/activity-log/ActivityLogTable";

const activityLogs = [
  {
    id: 1,
    date: "2026-04-07",
    time: "09:14",
    action: "Order Created",
    company: "Smith & Associates",
    module: "Orders",
    performedBy: "Sarah Chen",
    initials: "SC",
    details: "New order ORD-2026-001 created for Smith v. Johnson Pro",
  },
  {
    id: 2,
    date: "2026-04-07",
    time: "08:52",
    action: "Invoice Generated",
    company: "Martinez Legal Group",
    module: "Billing",
    performedBy: "Sarah Chen",
    initials: "SC",
    details: "Invoice INV-003 generated for Martinez Immigration Appeal",
  },
  {
    id: 3,
    date: "2026-04-07",
    time: "08:30",
    action: "Employee Added",
    company: "System",
    module: "Employees",
    performedBy: "John Doe",
    initials: "JD",
    details: "New employee Patricia Brown added to the system with role",
  },
  {
    id: 4,
    date: "2026-04-06",
    time: "17:42",
    action: "Order Updated",
    company: "Pacific Law Partners",
    module: "Orders",
    performedBy: "James Wilson",
    initials: "JW",
    details: "Status changed to Ready to Pickup for ORD-2026-003 Chen",
  },
  {
    id: 5,
    date: "2026-04-06",
    time: "15:30",
    action: "Invoice Resent",
    company: "Davis Law Firm",
    module: "Billing",
    performedBy: "Sarah Chen",
    initials: "SC",
    details: "Invoice resent to billing@davislawfirm.com for case 72058-2",
  },
  {
    id: 6,
    date: "2026-04-06",
    time: "14:16",
    action: "Payment Received",
    company: "Thompson Industries",
    module: "Billing",
    performedBy: "Greg Holt",
    initials: "GH",
    details: "Payment of $2,500.00 received via ACH for invoice INV-014",
  },
  {
    id: 7,
    date: "2026-04-06",
    time: "12:48",
    action: "Employee Terminated",
    company: "System",
    module: "Employees",
    performedBy: "Sarah Chen",
    initials: "SC",
    details: "Thomas Anderson terminated. Account deactivated and log",
  },
  {
    id: 8,
    date: "2026-04-06",
    time: "11:00",
    action: "Invoice Sent",
    company: "Coastal Insurance",
    module: "Billing",
    performedBy: "Sarah Chen",
    initials: "SC",
    details: "Bulk invoice sent to 5 companies for outstanding cases",
  },
  {
    id: 9,
    date: "2026-04-05",
    time: "11:05",
    action: "Billing Updated",
    company: "System",
    module: "Billing",
    performedBy: "Sarah Chen",
    initials: "SC",
    details: "Monthly billing rate updated from $450 to $475 per case",
  },
  {
    id: 10,
    date: "2026-04-05",
    time: "09:30",
    action: "Order Created",
    company: "Williams & Co.",
    module: "Orders",
    performedBy: "Sarah Chen",
    initials: "SC",
    details: "New order ORD-2026-004 created for Williams Criminal Defe",
  },
  {
    id: 11,
    date: "2026-04-04",
    time: "16:20",
    action: "Batch Scan Complete",
    company: "System",
    module: "Processing",
    performedBy: "Michael Chen",
    initials: "MC",
    details: "Batch scan completed for 47 documents across 12 cases",
  },
  {
    id: 12,
    date: "2026-04-04",
    time: "14:15",
    action: "Reminder Scheduled",
    company: "Brown Family Trust",
    module: "Orders",
    performedBy: "Amanda White",
    initials: "AW",
    details: "Pickup reminder scheduled for ORD-2026-005 Brown Estate",
  },
  {
    id: 13,
    date: "2026-04-04",
    time: "11:30",
    action: "Order Cancelled",
    company: "Rodriguez & Partners",
    module: "Orders",
    performedBy: "Lisa Thompson",
    initials: "LT",
    details: "ORD-2026-007 Rodriguez Divorce Settlement cancelled by cl",
  },
  {
    id: 14,
    date: "2026-04-03",
    time: "15:45",
    action: "Report Exported",
    company: "System",
    module: "Reports",
    performedBy: "David Kim",
    initials: "DK",
    details: "Outstanding Invoices Report exported as PDF for April 2026",
  },
  {
    id: 15,
    date: "2026-04-03",
    time: "10:00",
    action: "Writeoff Applied",
    company: "Lee Tech Holdings",
    module: "Billing",
    performedBy: "Robert Garcia",
    initials: "RG",
    details: "Writeoff applied to case 72108-2 for $1,900.00 — client settl",
  },
  {
    id: 16,
    date: "2026-04-02",
    time: "13:20",
    action: "Documents Uploaded",
    company: "Anderson Accounting",
    module: "Orders",
    performedBy: "Emily Rodriguez",
    initials: "ER",
    details: "3 files uploaded to ORD-2026-011 Anderson Tax Audit Defen",
  },
  {
    id: 17,
    date: "2026-04-02",
    time: "09:10",
    action: "Employee Updated",
    company: "System",
    module: "Employees",
    performedBy: "John Doe",
    initials: "JD",
    details: "Emily Rodriguez role changed from Processor to Senior Proce",
  },
  {
    id: 18,
    date: "2026-04-01",
    time: "16:35",
    action: "Security Login",
    company: "System",
    module: "Security",
    performedBy: "John Doe",
    initials: "JD",
    details: "Successful admin login from trusted device",
  },
  {
    id: 19,
    date: "2026-04-01",
    time: "13:40",
    action: "Order Processed",
    company: "Taylor Financial Group",
    module: "Processing",
    performedBy: "Michael Chen",
    initials: "MC",
    details: "Order packet processed and marked ready for review",
  },
  {
    id: 20,
    date: "2026-04-01",
    time: "09:22",
    action: "Invoice Updated",
    company: "Harrison Medical Group",
    module: "Billing",
    performedBy: "Sarah Chen",
    initials: "SC",
    details: "Invoice due date updated after customer request",
  },
];

const filters = [
  "All Modules",
  "Orders",
  "Billing",
  "Employees",
  "Processing",
  "Reports",
  "Security",
];

export default function ActivityLogPage() {
  const [activeFilter, setActiveFilter] = useState("All Modules");
  const [searchValue, setSearchValue] = useState("");

  const filteredLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      const matchesFilter =
        activeFilter === "All Modules" || log.module === activeFilter;

      const search = searchValue.trim().toLowerCase();

      const matchesSearch =
        !search ||
        log.action.toLowerCase().includes(search) ||
        log.company.toLowerCase().includes(search) ||
        log.module.toLowerCase().includes(search) ||
        log.performedBy.toLowerCase().includes(search) ||
        log.details.toLowerCase().includes(search);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, searchValue]);

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[18px] font-semibold text-[#111827]">
              Activity Log
            </h1>

            <p className="mt-1 text-[12px] text-[#64748B]">
              Track all system activities and user actions
            </p>
          </div>

          <Link
            href="/orders"
            className="inline-flex h-[34px] w-fit items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
          >
            <ArrowLeftIcon />
            Return to Orders
          </Link>
        </div>

        <div className="grid w-full grid-cols-1 items-center gap-4 2xl:grid-cols-[390px_auto_1fr]">
          <div className="relative w-full max-w-[390px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex w-[36px] items-center justify-center text-[#94A3B8]">
              <SearchIcon />
            </div>

            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search activities..."
              className="h-[36px] w-full rounded-[6px] border border-[#CBD5E1] bg-white pl-[38px] pr-3 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="shrink-0 text-[12px] font-medium text-[#64748B]">
              Filter:
            </span>

            <div className="flex flex-wrap items-center gap-1 rounded-[6px] border border-[#E2E8F0] bg-white p-[3px]">
              {filters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`h-[28px] shrink-0 rounded-[5px] px-4 text-[11px] font-semibold transition ${
                    activeFilter === filter
                      ? "bg-[#0097B2] text-white shadow-sm"
                      : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111827]"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <p className="justify-self-start text-[11px] text-[#64748B] 2xl:justify-self-end">
            Showing {filteredLogs.length} of {activityLogs.length} entries
          </p>
        </div>

        <ActivityLogTable logs={filteredLogs} />
      </div>
    </DashboardShell>
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

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
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