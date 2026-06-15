require("dotenv").config();

const app = require("./src/app");
const config = require("./src/config");
const { connectDatabase } = require("./src/config/database");
const logger = require("./src/utils/logger");

const PORT = config.port;

async function startServer() {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      logger.info(`DMS API running in ${config.nodeEnv} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server", { error: error.message });
    process.exit(1);
  }
}

startServer();
