const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

function errorHandler(err, _req, res, _next) {
  // multer raises MulterError (e.g. file too large) — treat as a 400.
  if (err && err.name === "MulterError") {
    const fileTooLarge = err.code === "LIMIT_FILE_SIZE";
    return res.status(400).json({
      success: false,
      message: fileTooLarge
        ? "Uploaded file exceeds the 10MB limit"
        : `File upload error: ${err.message}`,
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
