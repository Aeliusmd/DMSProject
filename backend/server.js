require("dotenv").config();

const app = require("./src/app");
const config = require("./src/config");
const { ensureFileServerReady } = require("./src/utils/fileStorage");
const { connectDatabase } = require("./src/config/database");

const PORT = config.port;

async function start() {
  if (config.fileServer) {
    try {
      const root = ensureFileServerReady();
      console.log(`FILE_SERVER ready: ${root}`);
    } catch (err) {
      console.warn(`FILE_SERVER warning: ${err.message}`);
    }
  } else {
    console.warn("FILE_SERVER is not set — document uploads will fail until configured");
  }

  try {
    await connectDatabase();
    console.log(`MySQL connected: ${config.db.name}@${config.db.host}`);
  } catch (err) {
    console.error(`MySQL connection failed: ${err.message}`);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`DMS API running in ${config.nodeEnv} mode on port ${PORT}`);
  });
}

start();
