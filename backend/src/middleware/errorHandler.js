const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const multer = require("multer");

function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File size must be 15MB or less"
        : err.message;

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

  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : "Internal server error";

  if (!err.isOperational) {
    logger.error(err.message, { stack: err.stack });
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || null,
  });
}

module.exports = errorHandler;
