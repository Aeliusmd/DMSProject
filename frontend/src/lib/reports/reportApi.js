import { request, ApiRequestError } from "@/lib/auth/authApi";
import { getAccessToken } from "@/lib/auth/authStorage";
import { API_BASE_URL } from "@/config/api";

function buildOrdersReportQuery(filters = {}) {
  const params = new URLSearchParams();

  if (filters.orderNo?.trim()) params.set("orderNo", filters.orderNo.trim());
  if (filters.caseNumber?.trim()) {
    params.set("caseNumber", filters.caseNumber.trim());
  }
  if (filters.doctor?.trim()) params.set("doctor", filters.doctor.trim());
  if (filters.fromDate) params.set("dateFrom", filters.fromDate);
  if (filters.toDate) params.set("dateTo", filters.toDate);
  if (filters.rushLevel) params.set("rushLevel", filters.rushLevel);
  if (filters.unpaidOnly) params.set("unpaidOnly", "1");
  if (filters.showDuplicates === false) params.set("showDuplicates", "0");

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function getOrdersReport(filters = {}) {
  const data = await request(
    `/reports/orders${buildOrdersReportQuery(filters)}`,
    { auth: true }
  );

  return {
    orders: data?.data?.orders || [],
    count: data?.data?.count || 0,
  };
}

function buildActivityReportQuery(filters = {}) {
  const params = new URLSearchParams();

  if (filters.reportDate) params.set("dateFrom", filters.reportDate);
  if (filters.throughDate) params.set("dateTo", filters.throughDate);
  if (filters.facilityId && filters.facilityId !== "all") {
    params.set("facilityId", String(filters.facilityId));
  }
  if (filters.activity && filters.activity !== "All") {
    params.set("activity", filters.activity);
  }
  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function getActivityReport(filters = {}) {
  const data = await request(
    `/reports/activity${buildActivityReportQuery(filters)}`,
    { auth: true }
  );

  return {
    companies: data?.data?.companies || [],
    summary: data?.data?.summary || { facilityCount: 0, totalCases: 0 },
  };
}

export async function downloadActivityReportPdf(filters = {}) {
  const params = new URLSearchParams();

  if (filters.reportDate) params.set("dateFrom", filters.reportDate);
  if (filters.throughDate) params.set("dateTo", filters.throughDate);
  if (filters.facilityId && filters.facilityId !== "all") {
    params.set("facilityId", String(filters.facilityId));
  }
  if (filters.facilityLabel) {
    params.set("facilityLabel", filters.facilityLabel);
  }
  if (filters.activity && filters.activity !== "All") {
    params.set("activity", filters.activity);
  }
  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const query = params.toString();
  const token = getAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/reports/activity/export${query ? `?${query}` : ""}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );

  if (!response.ok) {
    let message = "Failed to export activity report PDF";
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiRequestError(message, response.status);
  }

  const blob = await response.blob();
  const fileName =
    response.headers
      .get("Content-Disposition")
      ?.match(/filename="?([^"]+)"?/)?.[1] ||
    `activity-report-${filters.reportDate || "all"}-${filters.throughDate || "all"}.pdf`;

  return { blob, fileName };
}
