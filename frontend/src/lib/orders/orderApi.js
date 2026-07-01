import { request, ApiRequestError } from "@/lib/auth/authApi";
import { API_BASE_URL } from "@/config/api";
import { getAccessToken } from "@/lib/auth/authStorage";

function buildOrdersQuery(filters = {}) {
  const params = new URLSearchParams();

  if (filters.facility) params.set("facility", filters.facility);
  if (filters.company) params.set("company", filters.company);
  if (filters.year) params.set("year", filters.year);
  if (filters.period) params.set("period", filters.period);
  if (filters.status) params.set("status", filters.status);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.limit) params.set("limit", String(filters.limit));

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

const FILE_FIELDS = ["subpoenaFile", "additionalDocumentFile"];

function isFileLike(value) {
  return (
    (typeof File !== "undefined" && value instanceof File) ||
    (typeof Blob !== "undefined" && value instanceof Blob)
  );
}

function buildOrderFormData(payload = {}) {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (FILE_FIELDS.includes(key)) return;
    if (value === undefined || value === null) return;
    if (typeof value === "boolean") {
      formData.append(key, String(value));
      return;
    }
    // Skip arrays/objects (e.g. the documents list returned in edit mode).
    if (typeof value === "object") return;

    formData.append(key, value);
  });

  FILE_FIELDS.forEach((field) => {
    const file = payload[field];
    if (isFileLike(file)) {
      formData.append(field, file);
    }
  });

  return formData;
}

export async function getOrders(filters = {}) {
  const data = await request(`/orders${buildOrdersQuery(filters)}`, {
    auth: true,
    cache: "no-store",
  });

  return data?.data?.orders || [];
}

export async function getOrderFilterCompanies() {
  const data = await request("/orders/companies", { auth: true });
  return data?.data?.companies || [];
}

export async function searchOrderDoctors(query, { facility = "" } = {}) {
  const params = new URLSearchParams();
  params.set("q", query);
  if (facility) params.set("facility", String(facility));

  const data = await request(`/orders/doctors/search?${params.toString()}`, {
    auth: true,
  });

  return data?.data?.doctors || [];
}

export async function searchOrderDoctorAddresses(query) {
  const params = new URLSearchParams();
  params.set("q", query);

  const data = await request(`/orders/doctor-addresses/search?${params.toString()}`, {
    auth: true,
  });

  return data?.data?.addresses || [];
}

export async function getOrderStats() {
  const data = await request("/orders/stats", { auth: true });
  return data?.data?.stats || null;
}

export async function getOrder(id) {
  const data = await request(`/orders/${id}`, { auth: true });
  return data?.data?.order || null;
}

export async function createOrder(payload) {
  const data = await request("/orders", {
    method: "POST",
    auth: true,
    body: buildOrderFormData(payload),
  });

  return data?.data?.order;
}

export async function updateOrder(id, payload) {
  const data = await request(`/orders/${id}`, {
    method: "PUT",
    auth: true,
    body: buildOrderFormData(payload),
  });

  return data?.data?.order;
}

export async function deleteOrder(id) {
  await request(`/orders/${id}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function cancelOrder(id, { reason }) {
  const data = await request(`/orders/${id}/cancel`, {
    method: "POST",
    auth: true,
    body: { reason },
  });

  return data?.data?.order;
}

export async function getOrderReminders(scope = "my") {
  const data = await request(`/orders/reminders?scope=${scope}`, {
    auth: true,
  });
  return data?.data?.reminders || [];
}

export async function getDueRemindersToday() {
  const data = await request("/orders/reminders/due-today", { auth: true });
  return {
    reminders: data?.data?.reminders || [],
    enabled: data?.data?.enabled !== false,
  };
}

export async function getOrderNotes(id, { includeCalled = false, noteId = null } = {}) {
  const params = new URLSearchParams();
  if (includeCalled) params.set("includeCalled", "1");
  if (noteId) params.set("noteId", String(noteId));
  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await request(`/orders/${id}/notes${query}`, { auth: true });
  return data?.data?.notes || [];
}

export async function createOrderNote(id, { note, callbackDate, attachment }) {
  const formData = new FormData();
  formData.append("note", note ?? "");

  if (callbackDate) {
    formData.append("callbackDate", callbackDate);
  }

  if (attachment) {
    formData.append("attachment", attachment);
  }

  const data = await request(`/orders/${id}/notes`, {
    method: "POST",
    auth: true,
    body: formData,
  });

  return data?.data?.notes || [];
}

export async function updateOrderNote(
  orderId,
  noteId,
  { note, callbackDate, attachment } = {}
) {
  const formData = new FormData();
  formData.append("note", note ?? "");

  if (callbackDate) {
    formData.append("callbackDate", callbackDate);
  }

  if (attachment) {
    formData.append("attachment", attachment);
  }

  const data = await request(`/orders/${orderId}/notes/${noteId}`, {
    method: "PUT",
    auth: true,
    body: formData,
  });

  return data?.data || { notes: [], activityLogs: [] };
}

export async function getOrderActivityLogs(id) {
  const data = await request(`/orders/${id}/activity-logs`, { auth: true });
  return data?.data?.logs || [];
}

export async function uploadBatchScan(file) {
  const formData = new FormData();
  formData.append("file", file);

  const data = await request("/orders/batch-scan", {
    method: "POST",
    auth: true,
    body: formData,
  });

  return data?.data || null;
}

export async function uploadMedicalRecordsScan(
  orderId,
  file,
  { replace = false, recordType = "medical" } = {}
) {
  const formData = new FormData();
  formData.append("file", file);

  const params = new URLSearchParams();
  if (replace) params.set("replace", "true");
  if (recordType) params.set("recordType", recordType);
  const query = params.toString() ? `?${params.toString()}` : "";

  const data = await request(`/orders/${orderId}/scan-medical-records${query}`, {
    method: "POST",
    auth: true,
    body: formData,
  });

  return data?.data?.order || null;
}

export async function removeMedicalRecords(orderId, { recordType = null } = {}) {
  const params = new URLSearchParams();
  if (recordType) params.set("recordType", recordType);
  const query = params.toString() ? `?${params.toString()}` : "";

  const data = await request(`/orders/${orderId}/medical-records${query}`, {
    method: "DELETE",
    auth: true,
  });

  return data?.data?.order || null;
}

export async function uploadSingleSubpoena(file) {
  const formData = new FormData();
  formData.append("file", file);

  const data = await request("/orders/subpoena/upload", {
    method: "POST",
    auth: true,
    body: formData,
  });

  return data?.data || null;
}

export async function getUnprocessedSubpoenas() {
  const data = await request("/orders/unprocessed", { auth: true });
  return Array.isArray(data?.data) ? data.data : [];
}

export async function getUnprocessedSubpoenaById(extractId) {
  const data = await request(`/orders/unprocessed/${extractId}`, { auth: true });
  return data?.data || null;
}

export async function fetchUnprocessedSubpoenaPdf(extractId) {
  const token = getAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/orders/unprocessed/${extractId}/file`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );

  if (!response.ok) {
    let message = "Failed to load subpoena PDF";
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiRequestError(message, response.status);
  }

  return response.blob();
}

export async function fetchOrderSubpoenaPdf(orderId) {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/subpoena/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let message = "Failed to load order subpoena PDF";
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiRequestError(message, response.status);
  }

  return response.blob();
}

export async function fetchOrderMedicalRecordsPdf(orderId, { recordType = "medical" } = {}) {
  const token = getAccessToken();
  const params = new URLSearchParams();
  if (recordType) params.set("recordType", recordType);
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(
    `${API_BASE_URL}/orders/${orderId}/medical-records/file${query}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );

  if (!response.ok) {
    let message = "Failed to load medical records PDF";
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiRequestError(message, response.status);
  }

  return response.blob();
}

export async function fetchOrderPrintInvoicePdf(orderId) {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/invoice/print`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let message = "Failed to load print invoice PDF";
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiRequestError(message, response.status);
  }

  return response.blob();
}

export async function fetchOrderPrintXrayInvoicePdf(orderId) {
  const token = getAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/orders/${orderId}/invoice/xray/print`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );

  if (!response.ok) {
    let message = "Failed to load print X-Ray invoice PDF";
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiRequestError(message, response.status);
  }

  return response.blob();
}

export async function mailCompletedOrder(orderId, payload = {}) {
  const body = {};

  if (Array.isArray(payload.emails) && payload.emails.length) {
    body.emails = payload.emails;
  } else if (payload.email) {
    body.email = payload.email;
    if (Array.isArray(payload.additionalEmails) && payload.additionalEmails.length) {
      body.additionalEmails = payload.additionalEmails;
    }
  }

  if (payload.deliveryDate) {
    body.deliveryDate = payload.deliveryDate;
  }

  const data = await request(`/orders/${orderId}/mail`, {
    method: "POST",
    auth: true,
    body,
  });

  return data?.data || {};
}

export async function sendCopyServiceLetter(orderId, payload = {}) {
  const data = await request(`/orders/${orderId}/send-copy-letter`, {
    method: "POST",
    auth: true,
    body: payload,
  });

  return data?.data || {};
}

export async function recordOrderPickup(orderId, payload = {}) {
  const data = await request(`/orders/${orderId}/pickup`, {
    method: "POST",
    auth: true,
    body: payload,
  });

  return data?.data || {};
}

export async function recordOrderFax(orderId, payload = {}) {
  const data = await request(`/orders/${orderId}/fax`, {
    method: "POST",
    auth: true,
    body: payload,
  });

  return data?.data || {};
}
