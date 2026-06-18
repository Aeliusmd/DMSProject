import { request } from "@/lib/auth/authApi";

function buildQuery(filters = {}) {
  const params = new URLSearchParams();

  if (filters.type && filters.type !== "All") {
    params.set("type", filters.type);
  }

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }

  params.set("_", String(Date.now()));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function getNotifications(filters = {}) {
  const data = await request(`/notifications${buildQuery(filters)}`, {
    auth: true,
  });

  return {
    notifications: data?.data?.notifications || [],
    unreadCount: data?.data?.unreadCount || 0,
  };
}

export async function markNotificationAsRead(id) {
  const data = await request(`/notifications/${id}/read`, {
    method: "PATCH",
    auth: true,
  });

  return {
    unreadCount: data?.data?.unreadCount ?? 0,
  };
}

export async function markAllNotificationsAsRead() {
  const data = await request("/notifications/read-all", {
    method: "PATCH",
    auth: true,
  });

  return {
    unreadCount: data?.data?.unreadCount ?? 0,
  };
}
