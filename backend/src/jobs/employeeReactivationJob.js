const employeeService = require("../services/employeeService");
const logger = require("../utils/logger");
const { runSafely } = require("../utils/asyncHandler");

const CHECK_INTERVAL_MS = 60 * 1000;

function startEmployeeReactivationJob() {
  const run = runSafely("Employee reactivation job failed", async () => {
    const count = await employeeService.processScheduledReactivations();

    if (count > 0) {
      logger.info(`Auto-reactivated ${count} suspended employee(s)`);
    }
  });

  run();
  setInterval(run, CHECK_INTERVAL_MS).unref();
}

module.exports = { startEmployeeReactivationJob };
