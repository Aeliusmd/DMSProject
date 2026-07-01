const employeeService = require("../services/employeeService");
const logger = require("../utils/logger");

const CHECK_INTERVAL_MS = 60 * 1000;

function startEmployeeReactivationJob() {
  const run = async () => {
    try {
      const count = await employeeService.processScheduledReactivations();

      if (count > 0) {
        logger.info(`Auto-reactivated ${count} suspended employee(s)`);
      }
    } catch (error) {
      logger.error("Employee reactivation job failed", { error: error.message });
    }
  };

  run();
  setInterval(run, CHECK_INTERVAL_MS).unref();
}

module.exports = { startEmployeeReactivationJob };
