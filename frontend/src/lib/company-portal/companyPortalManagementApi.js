import { companyPortalFetch } from "./companyPortalFetch";

async function managementRequest(path, options = {}) {
  return companyPortalFetch(path, options);
}

export async function listCompanyEmployees(search = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const query = params.toString();
  return managementRequest(
    `/company-portal/employees${query ? `?${query}` : ""}`,
    { method: "GET" }
  );
}

export async function listCompanyEmployeesPaginated({
  search = "",
  cursor = null,
  pageSize = 10,
} = {}) {
  const params = new URLSearchParams();
  params.set("pagination", "keyset");
  params.set("pageSize", String(pageSize));
  if (search) params.set("search", search);
  if (cursor) params.set("cursor", String(cursor));
  return managementRequest(`/company-portal/employees?${params.toString()}`, {
    method: "GET",
  });
}

export async function createCompanyEmployee(payload) {
  return managementRequest("/company-portal/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCompanyWalletSummary() {
  return managementRequest("/company-portal/wallet", { method: "GET" });
}

export async function listCompanyWalletTransactions({
  cursor = null,
  pageSize = 10,
} = {}) {
  const params = new URLSearchParams();
  params.set("pageSize", String(pageSize));
  if (cursor) params.set("cursor", String(cursor));
  return managementRequest(
    `/company-portal/wallet/transactions?${params.toString()}`,
    { method: "GET" }
  );
}

export async function createCompanyWalletTopup(amount) {
  return managementRequest("/company-portal/wallet/topup", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function confirmCompanyWalletTopup(sessionId) {
  return managementRequest("/company-portal/wallet/confirm-topup", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function allocateCompanyWalletFunds({ employeeId, amount }) {
  return managementRequest("/company-portal/wallet/allocate", {
    method: "POST",
    body: JSON.stringify({ employeeId, amount }),
  });
}

export function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
