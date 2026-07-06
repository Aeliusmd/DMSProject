function normalizeFacilityName(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeZip(zip) {
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

module.exports = {
  normalizeFacilityName,
  normalizeZip,
  normalizeState,
  getFacilityLabel,
  findFacilityByNameMatch,
};
