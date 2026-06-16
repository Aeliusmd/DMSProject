import { request } from "@/lib/auth/authApi";

export async function getActivityLogs() {
  const data = await request("/activity-log", { auth: true });
  return data?.data?.logs || [];
}

export async function getEmployeeActivityLogs(employeeId) {
  const data = await request(`/activity-log/employees/${employeeId}`, {
    auth: true,
  });

  return data?.data?.logs || [];
}
