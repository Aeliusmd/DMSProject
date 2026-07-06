import { getFacility, resolveFacility } from "@/lib/facilities/facilityApi";

const draftFacilityStorageKey = (orderId) =>
  `dms:order-draft-facility:${orderId}`;

export function rememberDraftOrderFacility(orderId, { facilityId, facilityName }) {
  const id = `${orderId || ""}`.trim();
  const facility = `${facilityId || ""}`.trim();

  if (!id || !facility || typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      draftFacilityStorageKey(id),
      JSON.stringify({
        facilityId: facility,
        facilityName: `${facilityName || ""}`.trim(),
      })
    );
  } catch {
    // Ignore storage failures in private browsing.
  }
}

export function readDraftOrderFacility(orderId) {
  const id = `${orderId || ""}`.trim();

  if (!id || typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(draftFacilityStorageKey(id));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const facilityId = `${parsed?.facilityId || ""}`.trim();
    if (!facilityId) return null;

    return {
      facilityId,
      facilityName: `${parsed?.facilityName || ""}`.trim(),
    };
  } catch {
    return null;
  }
}

export function clearDraftOrderFacility(orderId) {
  const id = `${orderId || ""}`.trim();

  if (!id || typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(draftFacilityStorageKey(id));
  } catch {
    // Ignore storage failures.
  }
}

export function isSameFacilityLabel(left, right) {
  return (
    `${left || ""}`.trim().localeCompare(`${right || ""}`.trim(), undefined, {
      sensitivity: "accent",
    }) === 0
  );
}

export async function resolvePendingFacility({
  facilityName,
  facilityId = "",
} = {}) {
  const trimmedName = `${facilityName || ""}`.trim();
  const existingId = `${facilityId || ""}`.trim();

  if (existingId) {
    const facility = await getFacility(existingId);
    if (!facility) {
      if (!trimmedName) {
        return {
          facilityId: "",
          facilityName: "",
          facilityCreated: false,
          facilityProfileIncomplete: false,
        };
      }
    } else {
      const canonicalName =
        facility.facilityName || facility.facility || trimmedName;

      if (!trimmedName || isSameFacilityLabel(trimmedName, canonicalName)) {
        return {
          facilityId: String(facility.id),
          facilityName: canonicalName || trimmedName,
          facilityCreated: Boolean(facility.isAutoCreated),
          facilityProfileIncomplete: Boolean(facility.isProfileIncomplete),
        };
      }
    }
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
