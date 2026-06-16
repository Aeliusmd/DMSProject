import { request } from "@/lib/auth/authApi";

export async function getProviders() {
  const data = await request("/providers", { auth: true });
  return data?.data?.providers || [];
}

export async function searchProviders(query) {
  const params = new URLSearchParams();
  params.set("q", query);

  const data = await request(`/providers/search?${params.toString()}`, {
    auth: true,
  });

  return data?.data?.providers || [];
}

export async function getProvider(id) {
  const data = await request(`/providers/${id}`, { auth: true });
  return data?.data?.provider || null;
}
