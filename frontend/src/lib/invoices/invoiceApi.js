import { request } from "@/lib/auth/authApi";

const EMPTY_SUMMARY = {
  companies: 0,
  cases: 0,
  invoiced: "$0.00",
  paid: "$0.00",
  due: "$0.00",
};

function buildInvoiceQuery(filters = {}) {
  const params = new URLSearchParams();

  if (filters.type) params.set("type", filters.type);
  if (filters.tab) params.set("tab", filters.tab);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function getInvoices(filters = {}) {
  const data = await request(`/invoices${buildInvoiceQuery(filters)}`, {
    auth: true,
  });

  return {
    groups: data?.data?.groups || [],
    invoices: data?.data?.invoices || [],
    summary: data?.data?.summary || EMPTY_SUMMARY,
    count: data?.data?.count || 0,
  };
}

export async function getOutstandingInvoices(filters = {}) {
  return getInvoices({ ...filters, tab: "outstanding" });
}

export async function getResendInvoices(filters = {}) {
  return getInvoices({ ...filters, tab: "resend" });
}

export async function getInvoice(id) {
  const data = await request(`/invoices/${id}`, { auth: true });
  return data?.data?.invoice || null;
}

export async function createInvoice(payload) {
  const data = await request("/invoices", {
    method: "POST",
    auth: true,
    body: payload,
  });

  return data?.data?.invoice;
}

export async function updateInvoice(id, payload) {
  const data = await request(`/invoices/${id}`, {
    method: "PUT",
    auth: true,
    body: payload,
  });

  return data?.data?.invoice;
}

export async function sendInvoices(invoiceIds = [], emails = null) {
  const body = { invoiceIds };

  if (Array.isArray(emails) && emails.length) {
    body.emails = emails;
  }

  const data = await request("/invoices/send", {
    method: "POST",
    auth: true,
    body,
  });

  return data?.data || { sentCount: 0 };
}

export async function getCompanyWiseInvoices() {
  const data = await request("/invoices/company-wise", { auth: true });
  return {
    companies: data?.data?.companies || [],
    summary: data?.data?.summary || {
      companies: 0,
      totalCases: 0,
      needsResend: 0,
      invoiced: "$0.00",
      paid: "$0.00",
      due: "$0.00",
    },
  };
}

export async function getCompanyInvoices(companyId, filters = {}) {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);

  const queryString = params.toString();
  const data = await request(
    `/invoices/company-wise/${companyId}${queryString ? `?${queryString}` : ""}`,
    { auth: true }
  );

  return {
    company: data?.data?.company || { id: companyId, name: "Company", email: "" },
    invoices: data?.data?.invoices || [],
    summary: data?.data?.summary || {
      totalCases: 0,
      needsResend: 0,
      totalInvoiced: "$0.00",
      totalPaid: "$0.00",
      totalDue: "$0.00",
    },
  };
}

export async function getXrayInvoiceByOrderId(orderId) {
  const data = await request(`/invoices/xray/order/${orderId}`, { auth: true });
  return data?.data || { invoiceId: null, xray: null };
}

export async function saveXrayInvoice(payload) {
  const data = await request("/invoices/xray", {
    method: "POST",
    auth: true,
    body: payload,
  });

  return data?.data || null;
}

export async function writeOffInvoices(payload) {
  const data = await request("/invoices/write-off", {
    method: "POST",
    auth: true,
    body: payload,
  });

  return data?.data || { writtenOffCount: 0, invoices: [] };
}

export async function sendXrayInvoices(orderIds = [], emails = null) {
  const body = { orderIds };

  if (Array.isArray(emails) && emails.length) {
    body.emails = emails;
  }

  const data = await request("/invoices/xray/send", {
    method: "POST",
    auth: true,
    body,
  });

  return data?.data || { sentCount: 0 };
}

export async function resendXrayInvoices(orderIds = [], emails = null) {
  const body = { orderIds };

  if (Array.isArray(emails) && emails.length) {
    body.emails = emails;
  }

  const data = await request("/invoices/xray/resend", {
    method: "POST",
    auth: true,
    body,
  });

  return data?.data || { resentCount: 0 };
}

export async function resendInvoices(invoiceIds = [], emails = null) {
  const body = { invoiceIds };

  if (Array.isArray(emails) && emails.length) {
    body.emails = emails;
  }

  const data = await request("/invoices/resend", {
    method: "POST",
    auth: true,
    body,
  });

  return data?.data || { resentCount: 0 };
}

export function splitInvoicesForResend(invoices = []) {
  const standardIds = [];
  const xrayOrderIds = [];

  invoices.forEach((invoice) => {
    if (invoice.invoiceType === "xray") {
      const orderId = Number(invoice.orderId);
      if (Number.isFinite(orderId) && orderId > 0) {
        xrayOrderIds.push(orderId);
      }
      return;
    }

    const invoiceId = Number(invoice.invoiceDbId || invoice.id);
    if (Number.isFinite(invoiceId) && invoiceId > 0) {
      standardIds.push(invoiceId);
    }
  });

  return {
    standardIds: [...new Set(standardIds)],
    xrayOrderIds: [...new Set(xrayOrderIds)],
  };
}

export async function resendInvoiceSelection(invoices = []) {
  const { standardIds, xrayOrderIds } = splitInvoicesForResend(invoices);

  if (!standardIds.length && !xrayOrderIds.length) {
    throw new Error("No invoices selected for resend.");
  }

  if (standardIds.length) {
    await resendInvoices(standardIds);
  }

  if (xrayOrderIds.length) {
    await resendXrayInvoices(xrayOrderIds);
  }
}

export async function emailInvoiceByOrderId(orderId) {
  const data = await request(`/invoices/order/${orderId}/email`, {
    method: "POST",
    auth: true,
  });

  return data?.data || { emailed: false };
}

export async function emailXrayInvoiceByOrderId(orderId, emails = null) {
  const body = {};

  if (Array.isArray(emails) && emails.length) {
    body.emails = emails;
  }

  const data = await request(`/invoices/xray/order/${orderId}/email`, {
    method: "POST",
    auth: true,
    body,
  });

  return data?.data || { emailed: false };
}
