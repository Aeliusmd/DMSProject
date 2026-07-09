const ApiError = require("./ApiError");

const MYSQL_ERROR_MESSAGES = {
  ER_DUP_ENTRY: "This record already exists.",
  ER_NO_REFERENCED_ROW_2: "A related record was not found.",
  ER_ROW_IS_REFERENCED_2: "This record is in use and cannot be removed.",
  ER_BAD_NULL_ERROR: "A required field is missing.",
  ER_DATA_TOO_LONG: "One or more fields exceed the allowed length.",
  ER_TRUNCATED_WRONG_VALUE: "One or more fields contain an invalid value.",
  ER_PARSE_ERROR: "Invalid data was submitted.",
  ER_LOCK_WAIT_TIMEOUT: "The request timed out. Please try again.",
  ER_LOCK_DEADLOCK: "The request conflicted with another update. Please try again.",
};

const NETWORK_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENOTFOUND",
  "PROTOCOL_CONNECTION_LOST",
]);

function isJsonSyntaxError(error) {
  return (
    error instanceof SyntaxError &&
    (error.status === 400 || error.type === "entity.parse.failed")
  );
}

function mapMysqlError(error) {
  const code = error?.code;
  if (!code) return null;

  if (NETWORK_ERROR_CODES.has(code) || code === "ER_ACCESS_DENIED_ERROR") {
    return new ApiError(503, "Database is temporarily unavailable. Please try again.");
  }

  const message = MYSQL_ERROR_MESSAGES[code];
  if (message) {
    const statusCode =
      code === "ER_DUP_ENTRY"
        ? 409
        : code === "ER_LOCK_WAIT_TIMEOUT" || code === "ER_LOCK_DEADLOCK"
          ? 503
          : 400;

    return new ApiError(statusCode, message);
  }

  if (typeof code === "string" && code.startsWith("ER_")) {
    return new ApiError(400, "Database request could not be completed.");
  }

  return null;
}

function mapFileSystemError(error) {
  const code = error?.code;
  if (!code) return null;

  if (code === "ENOENT") {
    return new ApiError(404, "The requested file was not found.");
  }

  if (code === "EACCES" || code === "EPERM") {
    return new ApiError(403, "File access was denied.");
  }

  if (code === "ENOSPC") {
    return new ApiError(507, "Server storage is full. Please contact support.");
  }

  return null;
}

function mapAuthError(error) {
  const name = error?.name;
  if (!name) return null;

  if (name === "TokenExpiredError") {
    return new ApiError(401, "Session expired. Please sign in again.");
  }

  if (name === "JsonWebTokenError" || name === "NotBeforeError") {
    return new ApiError(401, "Invalid or expired session. Please sign in again.");
  }

  return null;
}

/**
 * Convert unknown runtime/I/O errors into safe ApiError responses for the client.
 */
function normalizeError(error) {
  if (!error) {
    return new ApiError(500, "Internal server error");
  }

  if (error instanceof ApiError) {
    return error;
  }

  if (isJsonSyntaxError(error)) {
    return new ApiError(400, "Invalid JSON in request body.");
  }

  const mapped =
    mapMysqlError(error) ||
    mapFileSystemError(error) ||
    mapAuthError(error);

  if (mapped) {
    mapped.cause = error;
    return mapped;
  }

  if (error.statusCode && error.message) {
    return new ApiError(error.statusCode, error.message, error.errors || null);
  }

  const fallback = new ApiError(500, "Internal server error");
  fallback.cause = error;
  return fallback;
}

module.exports = {
  normalizeError,
};
