const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

function errorHandler(err, _req, res, _next) {
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
