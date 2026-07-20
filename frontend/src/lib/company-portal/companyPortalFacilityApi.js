import { companyPortalFetch } from "./companyPortalFetch";

export async function searchCompanyPortalFacilities(query) {
  const params = new URLSearchParams();
  params.set("q", String(query || "").trim());
  const payload = await companyPortalFetch(
    `/company-portal/facilities/search?${params.toString()}`,
    { method: "GET" }
  );
  return payload?.data?.facilities || [];
}
