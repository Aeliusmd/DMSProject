require("dotenv").config();

const { startOpenTelemetry } = require("./src/telemetry");
startOpenTelemetry();

const app = require("./src/app");
const config = require("./src/config");
const { connectDatabase } = require("./src/config/database");
const { ensureUploadDirs } = require("./src/config/uploads");
const { ensureFileServerReady } = require("./src/utils/fileStorage");
const logger = require("./src/utils/logger");
const { startEmployeeReactivationJob } = require("./src/jobs/employeeReactivationJob");
const { startInvoiceReminderJob } = require("./src/jobs/invoiceReminderJob");

const PORT = config.port;

async function startServer() {
  try {
    await connectDatabase();
    ensureUploadDirs();

    if (config.fileServer) {
      try {
        const root = ensureFileServerReady();
        logger.info(`FILE_SERVER ready: ${root}`);
      } catch (err) {
        logger.warn(`FILE_SERVER warning: ${err.message}`);
      }
    } else {
      logger.warn(
        "FILE_SERVER is not set — batch scan uploads will fail until configured"
      );
    }

    app.listen(PORT, () => {
      logger.info(`DMS API running in ${config.nodeEnv} mode on port ${PORT}`);
      if (config.loadTestMode) {
        logger.warn("LOAD_TEST_MODE enabled — login responses include devOtp");
      }
      startEmployeeReactivationJob();
      startInvoiceReminderJob();
    });
  } catch (error) {
    logger.error("Failed to start server", {
      error: error.message,
      code: error.code,
    });
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    error: error.message,
    stack: error.stack,
  });
});

startServer();
