import { request } from "@/lib/auth/authApi";

export async function getSettings() {
  const data = await request("/settings", { auth: true });
  return data?.data?.settings || null;
}

export async function updateProfile(payload) {
  const data = await request("/settings/profile", {
    method: "PUT",
    auth: true,
    body: payload,
  });

  return data?.data?.settings;
}

export async function updateNotificationPreferences(notifications) {
  const data = await request("/settings/notifications", {
    method: "PUT",
    auth: true,
    body: notifications,
  });

  return data?.data?.settings;
}

export async function changePassword(payload) {
  const data = await request("/settings/password", {
    method: "PUT",
    auth: true,
    body: payload,
  });

  return data;
}
