import { request, authFetch, ApiRequestError } from "@/lib/auth/authApi";

export { ApiRequestError };

export async function getFacilities() {
  const data = await request("/facilities", { auth: true });
  return data?.data?.facilities || [];
}

export async function searchFacilities(query) {
  const params = new URLSearchParams();
  params.set("q", query);

  const data = await request(`/facilities/search?${params.toString()}`, {
    auth: true,
  });

  return data?.data?.facilities || [];
}

export async function resolveFacility(payload = {}) {
  const data = await request("/facilities/resolve", {
    method: "POST",
    auth: true,
    body: payload,
  });

  return {
    facility: data?.data?.facility || null,
    created: Boolean(data?.data?.created),
  };
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

  const response = await authFetch(`/facilities/${facilityId}/documents`, {
    method: "POST",
    body: formData,
  });

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
  const response = await authFetch(
    `/facilities/${facilityId}/documents/${documentId}/${action}`
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

export async function createFacilityNote(facilityId, { note, attachments = [] } = {}) {
  const formData = new FormData();
  formData.append("note", note ?? "");

  attachments.forEach((file) => {
    formData.append("attachments", file);
  });

  const data = await request(`/facilities/${facilityId}/notes`, {
    method: "POST",
    auth: true,
    body: formData,
  });

  return data?.data?.note;
}

export async function downloadFacilityNoteAttachment(
  facilityId,
  downloadPath,
  fileName
) {
  const normalizedPath = `${downloadPath || ""}`.replace(/^\/+/, "");
  const response = await authFetch(`/${normalizedPath}`);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiRequestError(
      data?.message || "Failed to download attachment",
      response.status
    );
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName || "attachment";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
