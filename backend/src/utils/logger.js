const config = require("../config");

function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  if (config.nodeEnv === "production") {
    console.log(JSON.stringify(entry));
    return;
  }

  console.log(`[${entry.level}] ${entry.message}`, meta);
}

module.exports = {
  info: (message, meta) => log("info", message, meta),
  warn: (message, meta) => log("warn", message, meta),
  error: (message, meta) => log("error", message, meta),
};
