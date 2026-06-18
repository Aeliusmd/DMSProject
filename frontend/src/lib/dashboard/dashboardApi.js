import { request } from "@/lib/auth/authApi";

export async function getDashboardStats() {
  const data = await request("/dashboard/stats", { auth: true });
  return data?.data?.stats || null;
}

export async function getTopProviders(limit = 5) {
  const data = await request(`/dashboard/top-providers?limit=${limit}`, {
    auth: true,
  });
  return data?.data?.providers || [];
}
