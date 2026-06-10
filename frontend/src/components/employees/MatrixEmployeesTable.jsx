"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ActivityLogModal from "@/components/ui/ActivityLogModal";

const employeeLogsSeed = {
  1: [
    {
      date: "06/04/26",
      by: "Matthew Perera",
      callback: "",
      note: "Login successful from dashboard portal.",
    },
    {
      date: "06/04/26",
      by: "Matthew Perera",
      callback: "",
      note: "Employee profile Updated by admin.",
    },
    {
      date: "06/03/26",
      by: "System",
      callback: "",
      note: "Password reset email sent.",
    },
    {
      date: "06/02/26",
      by: "Matthew Perera",
      callback: "",
      note: "Role Updated from Processor to Manager.",
    },
    {
      date: "06/01/26",
      by: "System",
      callback: "",
      note: "Login failed attempt recorded.",
    },
    {
      date: "06/01/26",
      by: "Matthew Perera",
      callback: "",
      note: "Employee account created.",
    },
  ],
  2: [
    {
      date: "06/04/26",
      by: "Sarah Chen",
      callback: "",
      note: "Login successful from office device.",
    },
    {
      date: "06/03/26",
      by: "Sarah Chen",
      callback: "",
      note: "Processed invoice records.",
    },
    {
      date: "06/02/26",
      by: "Matthew Perera",
      callback: "",
      note: "Employee schedule Updated.",
    },
    {
      date: "06/01/26",
      by: "System",
      callback: "",
      note: "Password changed successfully.",
    },
  ],
  3: [
    {
      date: "06/04/26",
      by: "John Doe",
      callback: "",
      note: "Login successful.",
    },
    {
      date: "06/03/26",
      by: "Matthew Perera",
      callback: "",
      note: "Employee permission Updated.",
    },
    {
      date: "06/02/26",
      by: "System",
      callback: "",
      note: "Security check completed.",
    },
  ],
};

function getEmployeeLogs(employee) {
  if (!employee) return [];

  return (
    employeeLogsSeed[employee.id] || [
      {
        date: "06/04/26",
        by: "Matthew Perera",
        callback: "",
        note: `${employee.name} Login successful.`,
      },
      {
        date: "06/03/26",
        by: "System",
        callback: "",
        note: `${employee.name} profile Updated automatically.`,
      },
      {
        date: "06/02/26",
        by: "Matthew Perera",
        callback: "",
        note: `${employee.name} employee record reviewed.`,
      },
      {
        date: "06/01/26",
        by: "System",
        callback: "",
        note: `${employee.name} account activity synced.`,
      },
    ]
  );
}

export default function MatrixEmployeesTable({
  employees,
  onTerminateEmployee,
  onDeleteEmployee,
  onActivateEmployee,
}) {
  const [tableEmployees, setTableEmployees] = useState(employees || []);

  const [confirmModal, setConfirmModal] = useState({
    open: false,
    action: null,
    employee: null,
  });

  const [activateSuccessModal, setActivateSuccessModal] = useState({
    open: false,
    employee: null,
  });

  const [selectedLogEmployee, setSelectedLogEmployee] = useState(null);

  useEffect(() => {
    setTableEmployees(employees || []);
  }, [employees]);

  const openTerminateModal = (employee) => {
    setConfirmModal({
      open: true,
      action: "terminate",
      employee,
    });
  };

  const openDeleteModal = (employee) => {
    setConfirmModal({
      open: true,
      action: "delete",
      employee,
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({
      open: false,
      action: null,
      employee: null,
    });
  };

  const handleConfirmAction = () => {
    const { action, employee } = confirmModal;

    if (!employee) return;

    if (action === "terminate") {
      setTableEmployees((prev) =>
        prev.map((item) =>
          item.id === employee.id ? { ...item, terminated: true } : item
        )
      );

      onTerminateEmployee?.(employee);
    }

    if (action === "delete") {
      setTableEmployees((prev) =>
        prev.filter((item) => item.id !== employee.id)
      );

      onDeleteEmployee?.(employee);
    }

    closeConfirmModal();
  };

  const handleActivateEmployee = (employee) => {
    const activatedEmployee = {
      ...employee,
      terminated: false,
    };

    setTableEmployees((prev) =>
      prev.map((item) =>
        item.id === employee.id ? activatedEmployee : item
      )
    );

    onActivateEmployee?.(activatedEmployee);

    setActivateSuccessModal({
      open: true,
      employee: activatedEmployee,
    });
  };

  const closeActivateSuccessModal = () => {
    setActivateSuccessModal({
      open: false,
      employee: null,
    });
  };

  const modalTitle =
    confirmModal.action === "delete"
      ? "Delete Employee"
      : "Terminate Employee";

  const modalMessage =
    confirmModal.action === "delete"
      ? `Are you sure you want to delete ${confirmModal.employee?.name}? This action cannot be undone.`
      : `Are you sure you want to terminate ${confirmModal.employee?.name}? Their account will be marked as terminated and they will no longer be able to log in.`;

  return (
    <>
      <section className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
        <div className="h-full overflow-auto">
          <table className="w-full min-w-[1080px] border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
                <th className="w-[60px] px-5 py-3">ID</th>
                <th className="w-[190px] px-5 py-3">Employee</th>
                <th className="w-[170px] px-5 py-3">Logon</th>
                <th className="w-[260px] px-5 py-3">Email</th>
                <th className="w-[150px] px-5 py-3">Role</th>
                <th className="w-[170px] px-5 py-3">Last Login</th>
                <th className="w-[130px] px-5 py-3 text-center">Status</th>
                <th className="w-[140px] px-5 py-3 text-center">Action</th>
                <th className="w-[110px] px-5 py-3 text-center">Delete</th>
              </tr>
            </thead>

            <tbody>
              {tableEmployees.map((employee) => (
                <tr
                  key={employee.id}
                  className="border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#F8FBFC] hover:bg-[#F1F9FB]"
                >
                  <td className="px-5 py-4 text-[12px] text-[#64748B]">
                    {employee.id}
                  </td>

                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setSelectedLogEmployee(employee)}
                      className={`text-left text-[12px] font-semibold ${
                        employee.terminated
                          ? "text-red-500 line-through hover:underline"
                          : "text-[#007F96] hover:underline"
                      }`}
                    >
                      {employee.name}
                    </button>
                  </td>

                  <td className="px-5 py-4 text-[12px] text-[#475569]">
                    <span>{employee.logon}</span>
                  </td>

                  <td className="px-5 py-4 text-[12px] text-[#475569]">
                    {employee.email}
                  </td>

                  <td className="px-5 py-4 text-[12px] text-[#475569]">
                    {employee.role}
                  </td>

                  <td className="px-5 py-4 text-[12px] text-[#64748B]">
                    {employee.lastLogin}
                  </td>

                  <td className="px-5 py-4 text-center">
                    {employee.terminated ? (
                      <span className="inline-flex h-[24px] items-center justify-center rounded-full bg-red-50 px-3 text-[11px] font-semibold text-red-500">
                        Terminated
                      </span>
                    ) : (
                      <span className="inline-flex h-[24px] items-center justify-center rounded-full bg-[#ECFDF5] px-3 text-[11px] font-semibold text-[#059669]">
                        Active
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-center">
                    {employee.terminated ? (
                      <button
                        type="button"
                        onClick={() => handleActivateEmployee(employee)}
                        className="inline-flex h-[28px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-[#86EFAC] bg-[#ECFDF5] px-3 text-[11px] font-semibold text-[#059669] hover:bg-[#DCFCE7]"
                      >
                        <ActivateIcon />
                        Activate User
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openTerminateModal(employee)}
                        className="inline-flex h-[28px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] px-3 text-[11px] font-semibold transition hover:opacity-85"
                        style={{
                          border: "1px solid #FCD34D",
                          backgroundColor: "#FFFBEB",
                          color: "#B45309",
                        }}
                      >
                        <SmallCircleIcon />
                        Terminate
                      </button>
                    )}
                  </td>

                  <td className="px-5 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => openDeleteModal(employee)}
                      className="inline-flex h-[28px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100"
                    >
                      <TrashIcon />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {tableEmployees.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-[13px] text-[#94A3B8]"
                  >
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        open={confirmModal.open}
        title={modalTitle}
        message={modalMessage}
        variant={confirmModal.action === "delete" ? "danger" : "warning"}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onCancel={closeConfirmModal}
        onConfirm={handleConfirmAction}
      />

      <ConfirmModal
        open={activateSuccessModal.open}
        title="User Activated"
        message={`${
          activateSuccessModal.employee?.name || "This user"
        } account is now re-activated and can do things in the system.`}
        variant="success"
        confirmLabel="OK"
        cancelLabel="Close"
        onCancel={closeActivateSuccessModal}
        onConfirm={closeActivateSuccessModal}
      />

      <ActivityLogModal
        isOpen={Boolean(selectedLogEmployee)}
        title="Employee Activity Log"
        reference={selectedLogEmployee?.name}
        logs={getEmployeeLogs(selectedLogEmployee)}
        onClose={() => setSelectedLogEmployee(null)}
      />
    </>
  );
}

function SmallCircleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ActivateIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12l4 4L19 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}