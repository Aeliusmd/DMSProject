import { request } from "@/lib/auth/authApi";

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
