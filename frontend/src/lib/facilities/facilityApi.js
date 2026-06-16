import { API_BASE_URL } from "@/config/api";
import { request, ApiRequestError } from "@/lib/auth/authApi";
import { getAccessToken } from "@/lib/auth/authStorage";

export { ApiRequestError };

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

export async function getFacilityDocuments(facilityId) {
  const data = await request(`/facilities/${facilityId}/documents`, {
    auth: true,
  });

  return data?.data?.documents || [];
}

export async function uploadFacilityDocument(facilityId, file, documentType) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);

  const accessToken = getAccessToken();

  const response = await fetch(
    `${API_BASE_URL}/facilities/${facilityId}/documents`,
    {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: formData,
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiRequestError(
      data?.message || "Failed to upload document",
      response.status,
      data?.errors || null
    );
  }

  return data?.data?.document;
}

async function fetchFacilityDocumentBlob(
  facilityId,
  documentId,
  action = "preview"
) {
  const accessToken = getAccessToken();

  const response = await fetch(
    `${API_BASE_URL}/facilities/${facilityId}/documents/${documentId}/${action}`,
    {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiRequestError(
      data?.message || "Failed to fetch document",
      response.status
    );
  }

  return response.blob();
}

export async function getFacilityDocumentPreviewBlob(facilityId, documentId) {
  return fetchFacilityDocumentBlob(facilityId, documentId, "preview");
}

export async function downloadFacilityDocument(
  facilityId,
  documentId,
  fileName
) {
  const blob = await fetchFacilityDocumentBlob(
    facilityId,
    documentId,
    "download"
  );

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName || "document";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function deleteFacilityDocument(facilityId, documentId) {
  await request(`/facilities/${facilityId}/documents/${documentId}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function getFacilityNotes(facilityId) {
  const data = await request(`/facilities/${facilityId}/notes`, { auth: true });
  return data?.data?.notes || [];
}

export async function createFacilityNote(facilityId, note) {
  const data = await request(`/facilities/${facilityId}/notes`, {
    method: "POST",
    auth: true,
    body: { note },
  });

  return data?.data?.note;
}
