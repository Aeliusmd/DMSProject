import { companyPortalFetch } from "./companyPortalFetch";

async function activityLogRequest(path, options = {}) {
  return companyPortalFetch(path, options);
}

function buildActivityLogQuery(filters = {}) {
  const params = new URLSearchParams();

  if (filters.module && filters.module !== "All Modules") {
    params.set("module", filters.module);
  }
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.employeeId) params.set("employeeId", String(filters.employeeId));
  if (filters.actorType && filters.actorType !== "all") {
    params.set("actorType", filters.actorType);
  }
  if (filters.pagination) params.set("pagination", String(filters.pagination));
  if (filters.cursor != null && `${filters.cursor}`.trim() !== "") {
    params.set("cursor", String(filters.cursor));
  }
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function getCompanyPortalActivityLogsPaginated(filters = {}) {
  const data = await activityLogRequest(
    `/company-portal/activity-log${buildActivityLogQuery({
      ...filters,
      pagination: "keyset",
    })}`,
    { method: "GET" }
  );

  const payload = data?.data;
  if (payload?.pagination) {
    return {
      logs: payload.logs || [],
      pagination: payload.pagination,
    };
  }

  return {
    logs: Array.isArray(payload?.logs)
      ? payload.logs
      : Array.isArray(payload)
        ? payload
        : [],
    pagination: {
      pageSize: Number(filters.pageSize) || 10,
      hasMore: false,
      nextCursor: null,
    },
  };
}
