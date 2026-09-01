function normalizeFacilityName(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeZip(zip) {
  // Match on the 5-digit base ZIP so ZIP+4 extracts still find the facility.
  const digits = String(zip || "").replace(/\D/g, "");
  return digits.slice(0, 5) || "";
}

function normalizeState(state) {
  return String(state || "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
}

function getFacilityLabel(facility) {
  return facility?.facility_name || facility?.facility || facility?.name || "";
}

function findFacilityByNameMatch(name, facilityList = []) {
  const normalized = normalizeFacilityName(name);
  if (!normalized || !facilityList.length) return null;

  return (
    facilityList.find(
      (facility) =>
        normalizeFacilityName(getFacilityLabel(facility)) === normalized
    ) || null
  );
}

function resolveBatchFacilityMismatch({
  chosenFacilityId,
  extractedFacilityId,
  chosenFacilityName = "",
  extractedFacilityName = "",
} = {}) {
  const chosen = Number(chosenFacilityId);
  const extracted = Number(extractedFacilityId);
  const chosenNormalized = normalizeFacilityName(chosenFacilityName);
  const extractedNormalized = normalizeFacilityName(extractedFacilityName);

  if (
    chosenNormalized &&
    extractedNormalized &&
    chosenNormalized === extractedNormalized
  ) {
    return false;
  }

  if (chosen && extracted) {
    return chosen !== extracted;
  }

  if (chosenNormalized && extractedNormalized) {
    return chosenNormalized !== extractedNormalized;
  }

  return false;
}

module.exports = {
  normalizeFacilityName,
  normalizeZip,
  normalizeState,
  getFacilityLabel,
  findFacilityByNameMatch,
  resolveBatchFacilityMismatch,
};
