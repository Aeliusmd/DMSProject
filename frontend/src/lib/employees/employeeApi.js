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

export async function terminateEmployee(id) {
  const data = await request(`/employees/${id}/terminate`, {
    method: "PATCH",
    auth: true,
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
