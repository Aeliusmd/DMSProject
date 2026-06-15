import { request } from "@/lib/auth/authApi";

export async function getFacilities() {
  const data = await request("/facilities", { auth: true });
  return data?.data?.facilities || [];
}

export async function getFacility(id) {
  const data = await request(`/facilities/${id}`, { auth: true });
  return data?.data?.facility || null;
}

export async function createFacility(payload) {
  const data = await request("/facilities", {
    method: "POST",
    auth: true,
    body: payload,
  });

  return data?.data?.facility;
}

export async function updateFacility(id, payload) {
  const data = await request(`/facilities/${id}`, {
    method: "PUT",
    auth: true,
    body: payload,
  });

  return data?.data?.facility;
}

export async function deleteFacility(id) {
  await request(`/facilities/${id}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function createDoctors(facilityId, doctors) {
  const data = await request(`/facilities/${facilityId}/doctors`, {
    method: "POST",
    auth: true,
    body: { doctors },
  });

  return data?.data?.doctors || [];
}

export async function deactivateDoctor(facilityId, doctorId) {
  const data = await request(
    `/facilities/${facilityId}/doctors/${doctorId}/deactivate`,
    {
      method: "PATCH",
      auth: true,
    }
  );

  return data?.data?.doctor;
}

export async function reactivateDoctor(facilityId, doctorId) {
  const data = await request(
    `/facilities/${facilityId}/doctors/${doctorId}/reactivate`,
    {
      method: "PATCH",
      auth: true,
    }
  );

  return data?.data?.doctor;
}

export async function setDefaultDoctor(facilityId, doctorId) {
  const data = await request(
    `/facilities/${facilityId}/doctors/${doctorId}/default`,
    {
      method: "PATCH",
      auth: true,
    }
  );

  return data?.data?.doctor;
}
