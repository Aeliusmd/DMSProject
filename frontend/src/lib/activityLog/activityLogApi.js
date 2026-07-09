import { request } from "@/lib/auth/authApi";

function buildActivityLogQuery(filters = {}) {
  const params = new URLSearchParams();

  if (filters.module && filters.module !== "All Modules") {
    params.set("module", filters.module);
  }
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.pagination) params.set("pagination", String(filters.pagination));
  if (filters.cursor != null && `${filters.cursor}`.trim() !== "") {
    params.set("cursor", String(filters.cursor));
  }
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));

  const query = params.toString();
  return query ? `?${query}` : "";
}

function normalizeActivityLogResponse(data, filters = {}) {
  const payload = data?.data;

  if (payload?.pagination) {
    return {
      logs: payload.logs || [],
      pagination: payload.pagination,
    };
  }

  if (Array.isArray(payload?.logs)) {
    return payload.logs;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return {
    logs: payload?.logs || [],
    pagination: {
      pageSize: Number(filters.pageSize) || 10,
      hasMore: false,
      nextCursor: null,
    },
  };
}

function normalizePaginatedResult(result, filters = {}) {
  if (Array.isArray(result)) {
    return {
      logs: result,
      pagination: {
        pageSize: Number(filters.pageSize) || 10,
        hasMore: false,
        nextCursor: null,
      },
    };
  }

  return result;
}

export async function getMyActivityLogs(filters = {}) {
  const data = await request(`/activity-log/me${buildActivityLogQuery(filters)}`, {
    auth: true,
    cache: "no-store",
  });

  return normalizeActivityLogResponse(data, filters);
}

export async function getActivityLogs(filters = {}) {
  const data = await request(`/activity-log${buildActivityLogQuery(filters)}`, {
    auth: true,
    cache: "no-store",
  });

  return normalizeActivityLogResponse(data, filters);
}

export async function getMyActivityLogsPaginated(filters = {}) {
  const result = await getMyActivityLogs({
    ...filters,
    pagination: "keyset",
  });

  return normalizePaginatedResult(result, filters);
}

export async function getActivityLogsPaginated(filters = {}) {
  const result = await getActivityLogs({
    ...filters,
    pagination: "keyset",
  });

  return normalizePaginatedResult(result, filters);
}

export async function getEmployeeActivityLogs(employeeId, filters = {}) {
  const data = await request(
    `/activity-log/employees/${employeeId}${buildActivityLogQuery(filters)}`,
    {
      auth: true,
      cache: "no-store",
    }
  );

  return normalizeActivityLogResponse(data, filters);
}

export async function getEmployeeActivityLogsPaginated(
  employeeId,
  { cursor = null, pageSize = 10, search = "" } = {}
) {
  const result = await getEmployeeActivityLogs(employeeId, {
    pagination: "keyset",
    cursor,
    pageSize,
    search,
  });

  return normalizePaginatedResult(result, { pageSize });
}
