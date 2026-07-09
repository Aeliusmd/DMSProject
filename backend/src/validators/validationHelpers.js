const { FIELD_LIMITS } = require("../utils/fieldLimits");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function trimToString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isBlank(value) {
  return value === undefined || value === null || `${value}`.trim() === "";
}

function isValidEmail(email) {
  return EMAIL_PATTERN.test(trimToString(email));
}

function isValidIsoDate(value) {
  const trimmed = trimToString(value);
  if (!ISO_DATE_PATTERN.test(trimmed)) return false;

  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isFutureDate(value) {
  if (!isValidIsoDate(value)) return false;

  const selectedDate = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return selectedDate > today;
}

function isValidSSN(ssn) {
  const trimmed = trimToString(ssn);
  if (/^XXX-XX-\d{4}$/i.test(trimmed)) return true;
  return /^\d{3}-\d{2}-\d{4}$/.test(trimmed);
}

function isValidMoney(value) {
  const trimmed = `${value ?? ""}`.trim();
  if (!trimmed) return false;
  return /^\d+(\.\d{1,2})?$/.test(trimmed) && Number.isFinite(Number(trimmed));
}

function isValidNonNegativeNumber(value) {
  if (isBlank(value)) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

function isValidPositiveIntId(value) {
  const number = Number(value);
  return Number.isFinite(number) && Number.isInteger(number) && number > 0;
}

function addMaxLengthError(errors, field, value, max) {
  const trimmed = trimToString(value);
  if (trimmed && trimmed.length > max) {
    errors.push({
      field,
      message: `${field} must be ${max} characters or less`,
    });
  }
}

function addOptionalIsoDateError(errors, field, value) {
  if (!isBlank(value) && !isValidIsoDate(value)) {
    errors.push({ field, message: "Enter a valid date" });
  }
}

module.exports = {
  FIELD_LIMITS,
  EMAIL_PATTERN,
  trimToString,
  getDigits,
  isBlank,
  isValidEmail,
  isValidIsoDate,
  isFutureDate,
  isValidSSN,
  isValidMoney,
  isValidNonNegativeNumber,
  isValidPositiveIntId,
  addMaxLengthError,
  addOptionalIsoDateError,
};
