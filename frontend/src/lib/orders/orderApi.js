import { request } from "@/lib/auth/authApi";

function buildOrdersQuery(filters = {}) {
  const params = new URLSearchParams();

  if (filters.facility) params.set("facility", filters.facility);
  if (filters.year) params.set("year", filters.year);
  if (filters.status) params.set("status", filters.status);
  if (filters.search?.trim()) params.set("search", filters.search.trim());

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
  });

  return data?.data?.orders || [];
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

export async function getOrderNotes(id) {
  const data = await request(`/orders/${id}/notes`, { auth: true });
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
