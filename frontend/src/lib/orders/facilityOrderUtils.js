import { getFacility, resolveFacility } from "@/lib/facilities/facilityApi";

const DRAFT_FORM_OMIT_KEYS = new Set(["subpoenaFile", "additionalDocumentFile"]);

const draftSessionStorageKey = (scope) => `dms:order-draft-session:${scope}`;

export function getDraftOrderScope({ orderId = "", subpoenaId = "" } = {}) {
  const order = `${orderId || ""}`.trim();
  if (order) return `order:${order}`;

  const subpoena = `${subpoenaId || ""}`.trim();
  if (subpoena) return `subpoena:${subpoena}`;

  return "new";
}

export function serializeFormForDraft(formData = {}) {
  const snapshot = {};

  for (const [key, value] of Object.entries(formData || {})) {
    if (DRAFT_FORM_OMIT_KEYS.has(key)) continue;
    if (value instanceof File) continue;
    snapshot[key] = value;
  }

  return snapshot;
}

export function hasDraftableOrderContent(formData = {}) {
  const data = formData || {};

  if (`${data.facility || ""}`.trim() || `${data.facilityName || ""}`.trim()) {
    return true;
  }

  if (`${data.subpoenaExtractId || ""}`.trim()) {
    return true;
  }

  const textFields = [
    "firstName",
    "lastName",
    "caseNumber",
    "orderNumber",
    "specificDoctor",
    "specificRecord",
    "serveCompanyName",
    "providerId",
  ];

  return textFields.some((field) => `${data[field] || ""}`.trim());
}

export function rememberDraftOrderSession(
  scope,
  { facilityId, facilityName, formSnapshot = null, extractionMeta = null } = {}
) {
  const draftScope = `${scope || ""}`.trim();

  if (!draftScope || typeof window === "undefined") {
    return;
  }

  try {
    const existing = readDraftOrderSession(draftScope, { allowIncomplete: true }) || {};
    const snapshot = formSnapshot || existing.formSnapshot || null;
    const resolvedFacilityId = `${facilityId || existing.facilityId || snapshot?.facility || ""}`.trim();
    const resolvedFacilityName = `${facilityName || existing.facilityName || snapshot?.facilityName || ""}`.trim();

    if (!resolvedFacilityId && !snapshot) {
      return;
    }

    window.sessionStorage.setItem(
      draftSessionStorageKey(draftScope),
      JSON.stringify({
        facilityId: resolvedFacilityId,
        facilityName: resolvedFacilityName,
        formSnapshot: snapshot,
        extractionMeta: extractionMeta || existing.extractionMeta || null,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Ignore storage failures in private browsing.
  }
}

export function readDraftOrderSession(scope, { allowIncomplete = false } = {}) {
  const draftScope = `${scope || ""}`.trim();

  if (!draftScope || typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(draftSessionStorageKey(draftScope));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const snapshot = parsed?.formSnapshot || null;
    const facilityId = `${parsed?.facilityId || snapshot?.facility || ""}`.trim();
    const facilityName = `${parsed?.facilityName || snapshot?.facilityName || ""}`.trim();

    if (!facilityId && !snapshot) return null;
    if (!allowIncomplete && !facilityId && !snapshot) return null;

    return {
      facilityId,
      facilityName,
      formSnapshot: snapshot,
      extractionMeta: parsed?.extractionMeta || null,
      savedAt: parsed?.savedAt || null,
    };
  } catch {
    return null;
  }
}

export function clearDraftOrderSession(scope) {
  const draftScope = `${scope || ""}`.trim();

  if (!draftScope || typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(draftSessionStorageKey(draftScope));
  } catch {
    // Ignore storage failures.
  }
}

export function rememberDraftOrderFacility(orderId, { facilityId, facilityName }) {
  rememberDraftOrderSession(getDraftOrderScope({ orderId }), {
    facilityId,
    facilityName,
  });
}

export function readDraftOrderFacility(orderId) {
  return readDraftOrderSession(getDraftOrderScope({ orderId }));
}

export function clearDraftOrderFacility(orderId) {
  clearDraftOrderSession(getDraftOrderScope({ orderId }));
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
