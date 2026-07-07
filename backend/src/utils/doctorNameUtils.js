function normalizeDoctorName(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/^(dr|doctor)\.?\s+/i, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDoctorPrefix(name) {
  return `${name || ""}`.trim().replace(/^(dr|doctor)\.?\s+/i, "");
}

function parseDoctorName(doctorName) {
  const cleaned = stripDoctorPrefix(doctorName);
  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return { firstName: "", middleName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], middleName: "", lastName: parts[0] };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], middleName: "", lastName: parts[1] };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function getDoctorLabel(row) {
  return [row?.first_name, row?.middle_name, row?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function findDoctorByNameMatch(name, doctorRows = []) {
  const normalized = normalizeDoctorName(name);
  if (!normalized || !doctorRows.length) return null;

  return (
    doctorRows.find(
      (row) => normalizeDoctorName(getDoctorLabel(row)) === normalized
    ) || null
  );
}

module.exports = {
  normalizeDoctorName,
  stripDoctorPrefix,
  parseDoctorName,
  getDoctorLabel,
  findDoctorByNameMatch,
};
