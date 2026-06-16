"use client";

import { useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import CustomersTable from "@/components/customers/CustomersTable";

const customersSeed = [
  {
    id: 1,
    customer: "Smith & Associates",
    city: "Beverly Hills",
    zip: "90210",
  },
  {
    id: 2,
    customer: "Martinez Legal Group",
    city: "Los Angeles",
    zip: "90017",
  },
  {
    id: 3,
    customer: "Pacific Law Partners",
    city: "San Francisco",
    zip: "94105",
  },
  {
    id: 4,
    customer: "Williams & Co.",
    city: "Houston",
    zip: "77002",
  },
  {
    id: 5,
    customer: "Brown Family Trust",
    city: "New York",
    zip: "10001",
  },
  {
    id: 6,
    customer: "Davis Law Firm",
    city: "Chicago",
    zip: "60601",
  },
  {
    id: 7,
    customer: "Rodriguez & Partners",
    city: "Miami",
    zip: "33101",
  },
  {
    id: 8,
    customer: "Thompson Industries",
    city: "Atlanta",
    zip: "30309",
  },
  {
    id: 9,
    customer: "Garcia Legal Services",
    city: "Phoenix",
    zip: "85001",
  },
  {
    id: 10,
    customer: "Lee Tech Holdings",
    city: "Seattle",
    zip: "98101",
  },
  {
    id: 11,
    customer: "Anderson Accounting",
    city: "Dallas",
    zip: "75201",
  },
  {
    id: 12,
    customer: "Taylor Financial Group",
    city: "Chicago",
    zip: "60606",
  },
  {
    id: 13,
    customer: "Harrison Medical Group",
    city: "Houston",
    zip: "77030",
  },
  {
    id: 14,
    customer: "O'Connor Legal",
    city: "Boston",
    zip: "02101",
  },
  {
    id: 15,
    customer: "Nelson Healthcare",
    city: "Orlando",
    zip: "32801",
  },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState(customersSeed);

  const handleNewCustomer = () => {
    console.log("Open new facility form");
  };

  const handleDeleteCustomer = (customer) => {
    setCustomers((prev) => prev.filter((item) => item.id !== customer.id));
    console.log("Deleted facility:", customer);
  };

  const handleNotes = (customer) => {
    console.log("Open facility notes:", customer);
  };

  const handleUpload = (customer) => {
    console.log("Open facility upload:", customer);
  };

  const handleUsers = (customer) => {
    console.log("Open facility users:", customer);
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center">
          <h1 className="shrink-0 text-[18px] font-semibold text-[#111827]">
            List of Facilities
          </h1>

          <div className="flex w-full flex-wrap items-center gap-3 lg:ml-auto lg:w-auto lg:justify-end">
            <Link
              href="/orders"
              className="inline-flex h-[36px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
            >
              <ArrowLeftIcon />
              Return to Orders
            </Link>

            <Link
              href="/customers/new"
              className="inline-flex h-[36px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-[#0086A0]"
            >
              <UserPlusIcon />
              New Facility
            </Link>
          </div>
        </div>

        <CustomersTable
          customers={customers}
          onNotes={handleNotes}
          onUpload={handleUpload}
          onUsers={handleUsers}
          onDelete={handleDeleteCustomer}
        />
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

function UserPlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19 8v6M22 11h-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}