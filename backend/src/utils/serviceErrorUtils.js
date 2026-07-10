const ApiError = require("./ApiError");
const { normalizeError } = require("./errorMapper");

/**
 * Re-throw a caught error as a safe ApiError for the global error handler.
 * Preserves existing ApiError instances and maps DB/JWT/FS/Stripe errors.
 */
function rethrowServiceError(error) {
  if (error instanceof ApiError) {
    throw error;
  }

  throw normalizeError(error);
}

/**
 * Standard DB transaction wrapper: begin, commit, rollback, release, map errors.
 */
async function withTransaction(pool, fn) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    rethrowServiceError(error);
  } finally {
    connection.release();
  }
}

/**
 * Non-critical async work (notifications, activity logs, milestone rollups).
 * Logs failures without failing the parent request.
 */
async function runNonCritical(label, fn, logger) {
  try {
    return await fn();
  } catch (error) {
    logger.warn(label, {
      error: error.message,
      code: error.code,
      name: error.name,
    });
    return null;
  }
}

module.exports = {
  rethrowServiceError,
  withTransaction,
  runNonCritical,
};
