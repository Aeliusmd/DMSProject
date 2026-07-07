import { resolveFacilityDoctor } from "@/lib/facilities/facilityApi";

export function hasSubpoenaExtractedDoctor(
  extractionMeta = {},
  formSnapshot = {}
) {
  const extracted = `${extractionMeta.extractedDoctorName || ""}`.trim();
  if (extracted) return true;

  return Boolean(
    `${formSnapshot.specificDoctor || ""}`.trim() &&
      !formSnapshot.specificDoctorIsDefault
  );
}

export function normalizeDoctorResolution(
  resolved,
  { extractedDoctorName = "", priorDoctorCreated = false } = {}
) {
  const extracted = `${extractedDoctorName || ""}`.trim();

  if (!extracted) {
    return resolved;
  }

  return {
    ...resolved,
    specificDoctorIsDefault: false,
    doctorCreated: Boolean(priorDoctorCreated || resolved.doctorCreated),
    missingDefaultDoctor: false,
  };
}

export function mapResolvedDoctorFields(resolved = {}) {
  return {
    specificDoctor: resolved.specificDoctor || "",
    specificDoctorId: resolved.specificDoctorId || "",
    specificDoctorIsDefault: Boolean(resolved.specificDoctorIsDefault),
    missingDefaultDoctor: Boolean(resolved.missingDefaultDoctor),
    doctorCreated: Boolean(resolved.doctorCreated),
  };
}

export async function resolvePendingDoctor({
  facilityId,
  doctorId = "",
  doctorName = "",
} = {}) {
  const id = `${facilityId || ""}`.trim();

  if (!id) {
    return {
      specificDoctor: "",
      specificDoctorId: "",
      specificDoctorIsDefault: false,
      doctorCreated: false,
      missingDefaultDoctor: false,
    };
  }

  const trimmedName = `${doctorName || ""}`.trim();
  const trimmedDoctorId = `${doctorId || ""}`.trim();
  const result = await resolveFacilityDoctor(id, {
    doctorId: trimmedDoctorId || undefined,
    doctorName: trimmedName || undefined,
    useDefaultWhenMissing: !trimmedName && !trimmedDoctorId,
  });

  return {
    specificDoctor: result.doctorName || "",
    specificDoctorId: result.doctor?.id ? String(result.doctor.id) : "",
    specificDoctorIsDefault: Boolean(result.usedDefault),
    doctorCreated: Boolean(result.created),
    missingDefaultDoctor: Boolean(result.missingDefault),
  };
}

export async function resolvePendingDoctorForOrder({
  facilityId,
  doctorId = "",
  doctorName = "",
  extractedDoctorName = "",
  priorDoctorCreated = false,
} = {}) {
  return mapResolvedDoctorFields(
    normalizeDoctorResolution(
      await resolvePendingDoctor({
        facilityId,
        doctorId,
        doctorName,
      }),
      { extractedDoctorName, priorDoctorCreated }
    )
  );
}
