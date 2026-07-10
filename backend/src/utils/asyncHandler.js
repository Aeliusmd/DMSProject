function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Run non-critical async work without failing the parent request.
 */
async function runSideEffect(label, fn) {
  try {
    return await fn();
  } catch (error) {
    const logger = require("./logger");
    logger.warn(label, {
      error: error.message,
      code: error.code,
    });
    return null;
  }
}

/**
 * Wrap non-route async work (jobs, scripts) so failures are logged safely.
 */
function runSafely(label, fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const logger = require("./logger");
      logger.error(label, {
        error: error.message,
        code: error.code,
        stack: error.stack,
      });
      return null;
    }
  };
}

module.exports = asyncHandler;
module.exports.runSafely = runSafely;
module.exports.runSideEffect = runSideEffect;
