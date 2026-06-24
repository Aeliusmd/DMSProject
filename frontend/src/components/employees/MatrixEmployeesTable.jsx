"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ActivityLogModal from "@/components/ui/ActivityLogModal";
import { ApiRequestError } from "@/lib/auth/authApi";
import { getEmployeeActivityLogs } from "@/lib/activityLog/activityLogApi";

function isAdminRole(role) {
  return String(role || "").trim().toLowerCase() === "admin";
}

export default function MatrixEmployeesTable({
  employees,
  readOnly = false,
  onTerminateEmployee,
  onDeleteEmployee,
  onActivateEmployee,
}) {
  const [prevEmployees, setPrevEmployees] = useState(employees);
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
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  if (employees !== prevEmployees) {
    setPrevEmployees(employees);
    setTableEmployees(employees || []);
  }

  const openTerminateModal = (employee) => {
    setActionError("");
    setConfirmModal({
      open: true,
      action: "terminate",
      employee,
    });
  };

  const openDeleteModal = (employee) => {
    setActionError("");
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

  const handleConfirmAction = async () => {
    const { action, employee } = confirmModal;

    if (!employee || actionLoading) return;

    setActionLoading(true);
    setActionError("");

    try {
      if (action === "terminate") {
        await onTerminateEmployee?.(employee);
      }

      if (action === "delete") {
        await onDeleteEmployee?.(employee);
      }

      closeConfirmModal();
    } catch (error) {
      setActionError(
        error instanceof ApiRequestError
          ? error.message
          : "Unable to complete this action"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateEmployee = async (employee) => {
    if (actionLoading) return;

    setActionLoading(true);
    setActionError("");

    try {
      const activatedEmployee = await onActivateEmployee?.(employee);

      setActivateSuccessModal({
        open: true,
        employee: activatedEmployee || employee,
      });
    } catch (error) {
      setActionError(
        error instanceof ApiRequestError
          ? error.message
          : "Unable to activate employee"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const closeActivateSuccessModal = () => {
    setActivateSuccessModal({
      open: false,
      employee: null,
    });
  };

  useEffect(() => {
    if (!selectedLogEmployee?.id) {
      setActivityLogs([]);
      setLogsError("");
      return undefined;
    }

    let cancelled = false;

    setLogsLoading(true);
    setLogsError("");

    getEmployeeActivityLogs(selectedLogEmployee.id)
      .then((logs) => {
        if (!cancelled) {
          setActivityLogs(logs);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setActivityLogs([]);
          setLogsError(
            error instanceof ApiRequestError
              ? error.message
              : "Unable to load activity logs"
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLogsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLogEmployee?.id]);

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
      {actionError && (
        <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
          {actionError}
        </p>
      )}

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
                {!readOnly && (
                  <>
                    <th className="w-[140px] px-5 py-3 text-center">Action</th>
                    <th className="w-[110px] px-5 py-3 text-center">Delete</th>
                  </>
                )}
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

                  {!readOnly && (
                    <>
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
                        ) : isAdminRole(employee.role) ? (
                          <span className="text-[11px] text-[#94A3B8]">—</span>
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
                    </>
                  )}
                </tr>
              ))}

              {tableEmployees.length === 0 && (
                <tr>
                  <td
                    colSpan={readOnly ? 7 : 9}
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
        confirmLabel={actionLoading ? "Processing..." : "Confirm"}
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
        logs={activityLogs}
        loading={logsLoading}
        error={logsError}
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