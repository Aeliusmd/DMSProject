import { request } from "@/lib/auth/authApi";

export async function getEmployees() {
  const data = await request("/employees", { auth: true });
  return data?.data?.employees || [];
}

export async function createEmployee(payload) {
  const data = await request("/employees", {
    method: "POST",
    auth: true,
    body: {
      name: payload.name,
      logon: payload.logon || payload.userName,
      email: payload.email,
      password: payload.password,
      role: payload.role,
    },
  });

  return data?.data?.employee;
}

export async function updateEmployee(id, payload) {
  const data = await request(`/employees/${id}`, {
    method: "PUT",
    auth: true,
    body: {
      name: payload.name,
      logon: payload.logon || payload.userName,
      email: payload.email,
      role: payload.role,
      ...(payload.password ? { password: payload.password } : {}),
    },
  });

  return data?.data?.employee;
}

export async function terminateEmployee(id) {
  const data = await request(`/employees/${id}/terminate`, {
    method: "PATCH",
    auth: true,
  });

  return data?.data?.employee;
}

export async function suspendEmployee(id, reactivatedDate) {
  const data = await request(`/employees/${id}/suspend`, {
    method: "PATCH",
    auth: true,
    body: { reactivatedDate },
  });

  return data?.data?.employee;
}

export async function activateEmployee(id) {
  const data = await request(`/employees/${id}/activate`, {
    method: "PATCH",
    auth: true,
  });

  return data?.data?.employee;
}

export async function deleteEmployee(id) {
  await request(`/employees/${id}`, {
    method: "DELETE",
    auth: true,
  });
}

function buildMilestoneQuery(filters = {}) {
  const params = new URLSearchParams();

  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function getMyMilestoneStats(filters = {}) {
  const data = await request(
    `/employees/me/milestone-stats${buildMilestoneQuery(filters)}`,
    { auth: true }
  );

  return data?.data?.stats || null;
}

export async function getEmployeeMilestoneStats(employeeId, filters = {}) {
  const data = await request(
    `/employees/${employeeId}/milestone-stats${buildMilestoneQuery(filters)}`,
    { auth: true }
  );

  return data?.data?.stats || null;
}
