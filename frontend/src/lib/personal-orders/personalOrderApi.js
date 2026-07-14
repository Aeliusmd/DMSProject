import { request } from "@/lib/auth/authApi";

export async function getPersonalOrderStats() {
  const response = await request("/personal-orders/stats", { auth: true });
  return response?.data || null;
}
