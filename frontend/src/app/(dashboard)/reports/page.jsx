"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import ReportsOrdersTable from "@/components/reports/ReportsOrdersTable";
import CurrentDateTime from "@/components/dashboard/CurrentDateTime";

const baseOrders = [
  {
    orderNo: "75228-1",
    subNo: "189990",
    status: "Active",
    invoiced: false,
    invoiceAmount: "$0.00",
    subpoenaDate: "2026-05-15",
    dateServed: "2026-05-20",
    applicant: "Astrid Ramirez",
    caseNumber: "ADJ 0821858",
    dob: "10/08/1988",
    ssn: "XXX-XX-1752",
    provider: "Gemini Legal Support, Inc.",
    recordsRequested: "Medical Records 05/28/16-present",
    doctor: "Gabriel Rubanenko, MD",
    address: "4521 Medical Center Dr, Suite 300, Los Angeles, CA",
  },
  {
    orderNo: "75229-1",
    subNo: "REC-187697",
    status: "Active",
    invoiced: true,
    invoiceAmount: "$17.00",
    subpoenaDate: "2026-05-18",
    dateServed: "2026-05-25",
    applicant: "Marco Delgado",
    caseNumber: "ADJ 0821901",
    dob: "03/22/1975",
    ssn: "XXX-XX-3481",
    provider: "Pacific Diagnostic Center",
    recordsRequested: "Radiology Records 01/15/20-present",
    doctor: "Sarah Chen, MD",
    address: "8900 Sunset Blvd West Hollywood, CA 90069",
  },
  {
    orderNo: "75230-1",
    subNo: "189903",
    status: "Ready",
    invoiced: true,
    invoiceAmount: "$15.00",
    subpoenaDate: "2026-04-10",
    dateServed: "2026-04-15",
    applicant: "Jennifer Walsh",
    caseNumber: "ADJ 0822044",
    dob: "07/14/1992",
    ssn: "XXX-XX-9823",
    provider: "Valley Medical Group",
    recordsRequested: "Complete Medical Records 06/01/18-present",
    doctor: "David Park, DO",
    address: "12044 Ventura Blvd, Studio City, CA 91604",
  },
  {
    orderNo: "75231-1",
    subNo: "189910",
    status: "Active",
    invoiced: false,
    invoiceAmount: "$0.00",
    subpoenaDate: "2026-05-01",
    dateServed: "2026-05-10",
    applicant: "Robert Kim",
    caseNumber: "ADJ 0822112",
    dob: "11/30/1980",
    ssn: "XXX-XX-4456",
    provider: "Kaiser Permanente",
    recordsRequested: "Surgical Records 03/10/19-present",
    doctor: "Amanda Foster, MD",
    address: "4900 W Sunset Blvd, Los Angeles, CA 90027",
  },
  {
    orderNo: "75231-2",
    subNo: "189911",
    status: "Active",
    invoiced: false,
    invoiceAmount: "$0.00",
    subpoenaDate: "2026-05-01",
    dateServed: "2026-05-10",
    applicant: "Robert Kim",
    caseNumber: "ADJ 0822112",
    dob: "11/30/1980",
    ssn: "XXX-XX-4456",
    provider: "Kaiser Permanente",
    recordsRequested: "Surgical Records 03/10/19-present",
    doctor: "Amanda Foster, MD",
    address: "4900 W Sunset Blvd, Los Angeles, CA 90027",
  },
  {
    orderNo: "75232-1",
    subNo: "1899301",
    status: "Ready",
    invoiced: true,
    invoiceAmount: "$220.00",
    subpoenaDate: "2026-03-01",
    dateServed: "2026-03-08",
    applicant: "Michael Brooks",
    caseNumber: "ADJ 0822315",
    dob: "05/17/1978",
    ssn: "XXX-XX-1123",
    provider: "UCLA Health",
    recordsRequested: "Oncology Records 02/10/17-present",
    doctor: "Elena Vasquez, MD",
    address: "200 Medical Plaza, Los Angeles, CA 90095",
  },
  {
    orderNo: "75234-1",
    subNo: "189940",
    status: "Active",
    invoiced: false,
    invoiceAmount: "$0.00",
    subpoenaDate: "2026-05-20",
    dateServed: "2026-05-28",
    applicant: "Angela Foster",
    caseNumber: "ADJ 0822388",
    dob: "12/03/1990",
    ssn: "XXX-XX-3344",
    provider: "Children's Hospital LA",
    recordsRequested: "Pediatric Records 04/05/20-present",
    doctor: "Thomas Reed, MD",
    address: "4650 Sunset Blvd, Los Angeles, CA 90027",
  },
  {
    orderNo: "75235-1",
    subNo: "189951",
    status: "Active",
    invoiced: true,
    invoiceAmount: "$175.00",
    subpoenaDate: "2026-04-22",
    dateServed: "2026-04-28",
    applicant: "Daniel Henderson",
    caseNumber: "ADJ 0822450",
    dob: "08/19/1983",
    ssn: "XXX-XX-5567",
    provider: "St. Joseph Hospital",
    recordsRequested: "Cardiology Records 01/10/19-present",
    doctor: "Patricia O'Brien, MD",
    address: "1100 W Stewart Dr, Orange, CA 92868",
  },
  {
    orderNo: "75236-1",
    subNo: "189963",
    status: "Active",
    invoiced: false,
    invoiceAmount: "$0.00",
    subpoenaDate: "2026-04-01",
    dateServed: "2026-04-08",
    applicant: "Sandra Lee",
    caseNumber: "ADJ 0822501",
    dob: "02/28/1995",
    ssn: "XXX-XX-8989",
    provider: "Hoag Hospital",
    recordsRequested: "OB/GYN Records 07/15/20-present",
    doctor: "Michelle Nguyen, MD",
    address: "1 Hoag Dr, Newport Beach, CA 92663",
  },
  {
    orderNo: "75237-1",
    subNo: "189970",
    status: "Active",
    invoiced: false,
    invoiceAmount: "$0.00",
    subpoenaDate: "2026-02-15",
    dateServed: "2026-02-22",
    applicant: "Carlos Rivera",
    caseNumber: "ADJ 0822567",
    dob: "06/11/1972",
    ssn: "XXX-XX-2234",
    provider: "MemorialCare Medical Group",
    recordsRequested: "Orthopedic Records 09/01/18-present",
    doctor: "Steven Kim, MD",
    address: "18111 Brookhurst St, Fountain Valley, CA 92708",
  },
];

const ordersSeed = Array.from({ length: 75 }, (_, index) => {
  const item = baseOrders[index % baseOrders.length];

  return {
    ...item,
    id: index + 1,
    orderNo:
      index < baseOrders.length
        ? item.orderNo
        : `${75238 + index}-${(index % 3) + 1}`,
    subNo: `${189990 + index}`,
  };
});

const initialFilters = {
  orderNo: "",
  caseNumber: "",
  doctor: "",
  fromDate: "",
  toDate: "",
  rushLevel: "",
};

export default function ReportsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [showUnpaidOrders, setShowUnpaidOrders] = useState(false);
  const [minimumColumns, setMinimumColumns] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const filteredOrders = useMemo(() => {
    let result = ordersSeed.filter((order) => {
      const matchesOrderNo = order.orderNo
        .toLowerCase()
        .includes(filters.orderNo.trim().toLowerCase());

      const matchesCaseNumber = order.caseNumber
        .toLowerCase()
        .includes(filters.caseNumber.trim().toLowerCase());

      const matchesDoctor = order.doctor
        .toLowerCase()
        .includes(filters.doctor.trim().toLowerCase());

      const orderDate = parseDate(order.subpoenaDate);
      const fromDate = filters.fromDate ? parseDate(filters.fromDate) : null;
      const toDate = filters.toDate ? parseDate(filters.toDate) : null;

      const matchesFromDate = fromDate ? orderDate >= fromDate : true;
      const matchesToDate = toDate ? orderDate <= toDate : true;

      const rushLevel = calculateRushLevel(order.subpoenaDate);
      const matchesRush = filters.rushLevel
        ? rushLevel === filters.rushLevel
        : true;

      return (
        matchesOrderNo &&
        matchesCaseNumber &&
        matchesDoctor &&
        matchesFromDate &&
        matchesToDate &&
        matchesRush
      );
    });

    if (showUnpaidOrders) {
      result = result.filter((order) => !order.invoiced);
    }

    if (!showDuplicates) {
      result = result.filter((order, index, array) => {
        return array.findIndex((item) => item.orderNo === order.orderNo) === index;
      });
    }

    return result;
  }, [filters, showUnpaidOrders, showDuplicates]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col overflow-hidden bg-white">
        <div className="flex flex-col gap-3 border-b border-[#E2E8F0] bg-white px-3 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-5">
              <h1 className="shrink-0 text-[15px] font-semibold text-[#111827]">
                DMS Orders
              </h1>

              <div className="hidden h-[22px] w-px bg-[#E2E8F0] md:block" />

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowUnpaidOrders((prev) => !prev)}
                  className={`text-[11px] font-semibold ${
                    showUnpaidOrders
                      ? "text-[#007F96]"
                      : "text-[#111827] hover:text-[#007F96]"
                  }`}
                >
                  Unpaid Orders
                </button>

                <button
                  type="button"
                  onClick={() => setMinimumColumns((prev) => !prev)}
                  className={`text-[11px] font-semibold ${
                    minimumColumns
                      ? "text-[#007F96]"
                      : "text-[#111827] hover:text-[#007F96]"
                  }`}
                >
                  Minimum Columns
                </button>

                <button
                  type="button"
                  onClick={() => setShowDuplicates((prev) => !prev)}
                  className={`text-[11px] font-semibold ${
                    showDuplicates
                      ? "text-[#007F96]"
                      : "text-[#111827] hover:text-[#007F96]"
                  }`}
                >
                  Show Duplicates
                </button>

                <Link
                  href="/reports/activity-report"
                  className="inline-flex h-[28px] items-center justify-center gap-2 rounded-[5px] bg-[#0097B2] px-3 text-[11px] font-semibold text-white hover:bg-[#0086A0]"
                >
                  <ReportIcon />
                  Activity Report
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 text-[11px] text-[#111827]">
              <span>Found</span>
              <span className="font-semibold">{filteredOrders.length}</span>
              <span>records as of</span>
              <CurrentDateTime />
            </div>
          </div>

          <ReportsFilters
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
          />
        </div>

        <ReportsOrdersTable
          orders={filteredOrders}
          minimumColumns={minimumColumns}
          recordsPerPage={25}
        />
      </div>
    </DashboardShell>
  );
}

function ReportsFilters({ filters, onChange, onReset }) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] p-2 md:grid-cols-2 xl:grid-cols-[150px_150px_150px_145px_145px_135px_auto]">
      <FilterInput
        label="Order Number"
        name="orderNo"
        value={filters.orderNo}
        onChange={onChange}
        placeholder="Order #"
      />

      <FilterInput
        label="Case Number"
        name="caseNumber"
        value={filters.caseNumber}
        onChange={onChange}
        placeholder="Case #"
      />

      <FilterInput
        label="Doctor"
        name="doctor"
        value={filters.doctor}
        onChange={onChange}
        placeholder="Doctor"
      />

      <DateFilter
        label="From Date"
        name="fromDate"
        value={filters.fromDate}
        onChange={onChange}
      />

      <DateFilter
        label="To Date"
        name="toDate"
        value={filters.toDate}
        onChange={onChange}
      />

      <RushFilter value={filters.rushLevel} onChange={onChange} />

      <button
        type="button"
        onClick={onReset}
        className="h-[28px] self-end rounded-[4px] border border-[#CBD5E1] bg-white px-3 text-[11px] font-semibold text-[#475569] hover:bg-[#F1F5F9]"
      >
        Reset
      </button>
    </div>
  );
}

function FilterInput({ label, name, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
        {label}
      </label>

      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-[28px] w-full rounded-[4px] border border-[#CBD5E1] bg-white px-2 text-[11px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2]"
      />
    </div>
  );
}

function DateFilter({ label, name, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
        {label}
      </label>

      <input
        type="date"
        name={name}
        value={value}
        onChange={onChange}
        className="h-[28px] w-full rounded-[4px] border border-[#CBD5E1] bg-white px-2 text-[11px] text-[#111827] outline-none focus:border-[#0097B2]"
      />
    </div>
  );
}

function RushFilter({ value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
        Rush Level
      </label>

      <select
        name="rushLevel"
        value={value}
        onChange={onChange}
        className="h-[28px] w-full rounded-[4px] border border-[#CBD5E1] bg-white px-2 text-[11px] text-[#111827] outline-none focus:border-[#0097B2]"
      >
        <option value="">All Rush</option>
        <option value="Rush 1">Rush 1</option>
        <option value="Rush 2">Rush 2</option>
        <option value="Rush 3">Rush 3</option>
      </select>
    </div>
  );
}

function parseDate(dateValue) {
  return new Date(`${dateValue}T00:00:00`);
}

function calculateRushLevel(dateValue) {
  if (!dateValue) return null;

  const orderDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(orderDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffInMs = today.getTime() - orderDate.getTime();
  const daysOld = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (daysOld < 0) return null;
  if (daysOld <= 7) return "Rush 3";
  if (daysOld <= 21) return "Rush 2";

  return "Rush 1";
}

function ReportIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 20V4h12v16H6Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 9h6M9 13h6M9 17h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}