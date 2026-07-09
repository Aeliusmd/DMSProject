const ApiError = require("./ApiError");

function escapeLike(value) {
  return `${value || ""}`.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function likeContains(value) {
  return `%${escapeLike(value)}%`;
}

function likePrefix(value) {
  return `${escapeLike(value)}%`;
}

function assertPositiveInt(value, fieldName, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new ApiError(400, `Invalid ${fieldName}`);
  }
  return Math.min(n, max);
}

function assertIsoDate(value, fieldName) {
  const trimmed = `${value || ""}`.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new ApiError(400, `Invalid ${fieldName}`);
  }
  return trimmed;
}

function parseOptionalIsoDate(value, fieldName) {
  const trimmed = `${value || ""}`.trim();
  if (!trimmed) return null;
  return assertIsoDate(trimmed, fieldName);
}

function assertEnum(value, allowed, fieldName) {
  if (!allowed.has(value)) {
    throw new ApiError(400, `Invalid ${fieldName}`);
  }
  return value;
}

module.exports = {
  escapeLike,
  likeContains,
  likePrefix,
  assertPositiveInt,
  assertIsoDate,
  parseOptionalIsoDate,
  assertEnum,
};
