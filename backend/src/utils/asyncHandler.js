function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Run non-critical async work without failing the parent request.
 */
async function runSideEffect(label, fn) {
  const { runNonCritical } = require("./serviceErrorUtils");
  const logger = require("./logger");
  return runNonCritical(label, fn, logger);
}

/**
 * Wrap non-route async work (jobs, scripts) so failures are logged safely.
 */
function runSafely(label, fn) {
  const logger = require("./logger");

  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(label, {
        error: error.message,
        code: error.code,
        name: error.name,
      });
      return null;
    }
  };
}

module.exports = asyncHandler;
module.exports.runSafely = runSafely;
module.exports.runSideEffect = runSideEffect;
