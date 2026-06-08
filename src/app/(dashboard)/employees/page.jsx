"use client";

import { useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import MatrixEmployeesTable from "@/components/employees/MatrixEmployeesTable";
import EmployeeFormModal from "@/components/employees/EmployeeFormModal";

const employeesSeed = [
  {
    id: 1,
    name: "John Doe",
    logon: "jdoe",
    email: "jdoe@dmscustodian.com",
    lastLogin: "05/29/26 09:03AM",
    terminated: false,
  },
  {
    id: 2,
    name: "Sarah Johnson",
    logon: "sjohnson",
    email: "sjohnson@dmscustodian.com",
    lastLogin: "05/28/26 02:45PM",
    terminated: false,
  },
  {
    id: 3,
    name: "Michael Chen",
    logon: "mchen",
    email: "mchen@dmscustodian.com",
    lastLogin: "05/27/26 11:12AM",
    terminated: false,
  },
  {
    id: 4,
    name: "Emily Rodriguez",
    logon: "erodriguez",
    email: "erodriguez@dmscustodian.com",
    lastLogin: "05/26/26 04:30PM",
    terminated: false,
  },
  {
    id: 5,
    name: "David Kim",
    logon: "dkim",
    email: "dkim@dmscustodian.com",
    lastLogin: "05/25/26 08:15AM",
    terminated: false,
  },
  {
    id: 6,
    name: "Lisa Thompson",
    logon: "lthompson",
    email: "lthompson@dmscustodian.com",
    lastLogin: "05/24/26 10:22AM",
    terminated: false,
  },
  {
    id: 7,
    name: "Robert Garcia",
    logon: "rgarcia",
    email: "rgarcia@dmscustodian.com",
    lastLogin: "05/23/26 03:45PM",
    terminated: false,
  },
  {
    id: 8,
    name: "Amanda White",
    logon: "awhite",
    email: "awhite@dmscustodian.com",
    lastLogin: "05/22/26 01:10PM",
    terminated: false,
  },
  {
    id: 9,
    name: "James Wilson",
    logon: "jwilson",
    email: "jwilson@dmscustodian.com",
    lastLogin: "05/21/26 09:50AM",
    terminated: false,
  },
  {
    id: 10,
    name: "Patricia Brown",
    logon: "pbrown",
    email: "pbrown@dmscustodian.com",
    lastLogin: "05/20/26 11:35AM",
    terminated: false,
  },
  {
    id: 11,
    name: "Mark Davis",
    logon: "mdavis",
    email: "mdavis@dmscustodian.com",
    lastLogin: "05/19/26 02:00PM",
    terminated: false,
  },
  {
    id: 12,
    name: "Jennifer Martinez",
    logon: "jmartinez",
    email: "jmartinez@dmscustodian.com",
    lastLogin: "05/18/26 08:45AM",
    terminated: false,
  },
  {
    id: 13,
    name: "Thomas Anderson",
    logon: "tanderson",
    email: "tanderson@dmscustodian.com",
    lastLogin: "05/15/26 04:20PM",
    terminated: true,
  },
  {
    id: 14,
    name: "Maria Lopez",
    logon: "mlopez",
    email: "mlopez@dmscustodian.com",
    lastLogin: "05/10/26 10:30AM",
    terminated: true,
  },
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState(employeesSeed);
  const [isNewEmployeeModalOpen, setIsNewEmployeeModalOpen] = useState(false);

  const handleCreateEmployee = (newEmployeeData) => {
    const nextId =
      employees.length > 0
        ? Math.max(...employees.map((employee) => employee.id)) + 1
        : 1;

    const newEmployee = {
      id: nextId,
      name: newEmployeeData.name,
      logon: newEmployeeData.logon,
      email: newEmployeeData.email,
      lastLogin: "Never",
      terminated: false,
    };

    setEmployees((prev) => [newEmployee, ...prev]);
    setIsNewEmployeeModalOpen(false);

    console.log("Created employee:", newEmployee);
  };

  const handleTerminateEmployee = (employee) => {
    setEmployees((prev) =>
      prev.map((item) =>
        item.id === employee.id ? { ...item, terminated: true } : item
      )
    );

    console.log("Terminated employee:", employee);
  };

  const handleDeleteEmployee = (employee) => {
    setEmployees((prev) => prev.filter((item) => item.id !== employee.id));

    console.log("Deleted employee:", employee);
  };

  const handleActivity = () => {
    console.log("Open employee activity");
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center">
          <h1 className="shrink-0 text-[18px] font-semibold text-[#111827]">
            List of Matrix Employees
          </h1>

          <div className="flex w-full flex-wrap items-center gap-3 lg:ml-auto lg:w-auto lg:justify-end">
            <Link
              href="/orders"
              className="inline-flex h-[36px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
            >
              <ArrowLeftIcon />
              Return to Orders
            </Link>

            <button
              type="button"
              onClick={() => setIsNewEmployeeModalOpen(true)}
              className="inline-flex h-[36px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-[#0086A0]"
            >
              <UserPlusIcon />
              New Matrix Employee
            </button>

            <button
              type="button"
              onClick={handleActivity}
              className="inline-flex h-[36px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
            >
              <ActivityIcon />
              Activity
            </button>
          </div>
        </div>

        <MatrixEmployeesTable
          employees={employees}
          onTerminateEmployee={handleTerminateEmployee}
          onDeleteEmployee={handleDeleteEmployee}
        />

        <EmployeeFormModal
          open={isNewEmployeeModalOpen}
          onClose={() => setIsNewEmployeeModalOpen(false)}
          onCreate={handleCreateEmployee}
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

function ActivityIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M4 5h16v14H4V5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 9h8M8 13h6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}