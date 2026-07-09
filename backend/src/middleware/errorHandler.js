const multer = require("multer");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const { normalizeError } = require("../utils/errorMapper");

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof multer.MulterError || err?.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file exceeds the 10MB limit"
        : `File upload error: ${err.message}`;

    return res.status(400).json({
      success: false,
      message,
      errors: null,
    });
  }

  if (err && !(err instanceof ApiError) && err.message === "Unsupported file type") {
    return res.status(400).json({
      success: false,
      message: err.message,
      errors: null,
    });
  }

  const normalized = normalizeError(err);
  const statusCode = normalized.statusCode || 500;
  const message = normalized.isOperational
    ? normalized.message
    : "Internal server error";

  if (!normalized.isOperational) {
    logger.error(normalized.cause?.message || err?.message || "Unhandled error", {
      path: req.originalUrl,
      method: req.method,
      stack: normalized.cause?.stack || err?.stack,
      code: normalized.cause?.code || err?.code,
    });
  } else if (normalized.cause && statusCode >= 500) {
    logger.error(normalized.cause.message, {
      path: req.originalUrl,
      method: req.method,
      stack: normalized.cause.stack,
      code: normalized.cause.code,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: normalized.errors || null,
  });
}

module.exports = errorHandler;
