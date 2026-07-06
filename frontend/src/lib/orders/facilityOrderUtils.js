import { getFacility, resolveFacility } from "@/lib/facilities/facilityApi";

export async function resolvePendingFacility({
  facilityName,
  facilityId = "",
} = {}) {
  const trimmedName = `${facilityName || ""}`.trim();
  const existingId = `${facilityId || ""}`.trim();

  if (existingId) {
    const facility = await getFacility(existingId);
    return {
      facilityId: String(facility.id),
      facilityName: facility.facilityName || trimmedName,
      facilityCreated: Boolean(facility.isAutoCreated),
      facilityProfileIncomplete: Boolean(facility.isProfileIncomplete),
    };
  }

  if (!trimmedName) {
    return {
      facilityId: "",
      facilityName: "",
      facilityCreated: false,
      facilityProfileIncomplete: false,
    };
  }

  const { facility, created } = await resolveFacility({ facilityName: trimmedName });

  return {
    facilityId: String(facility.id),
    facilityName: facility.facility || facility.facilityName || trimmedName,
    facilityCreated: created,
    facilityProfileIncomplete: Boolean(facility.isProfileIncomplete),
  };
}

export async function refreshFacilityProfileStatus(facilityId) {
  const id = `${facilityId || ""}`.trim();
  if (!id) {
    return {
      facilityProfileIncomplete: false,
      facilityCreated: false,
    };
  }

  const facility = await getFacility(id);
  return {
    facilityProfileIncomplete: Boolean(facility?.isProfileIncomplete),
    facilityCreated: Boolean(facility?.isAutoCreated),
  };
}
