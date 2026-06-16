const path = require("path");

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "3306";
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const name = process.env.DB_NAME;

  if (!host || !user || !name) {
    return "";
  }

  const encodedPassword = encodeURIComponent(password || "");
  return `mysql://${user}:${encodedPassword}@${host}:${port}/${name}`;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  databaseUrl: buildDatabaseUrl(),
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    name: process.env.DB_NAME || "dms_db_dev",
  },
  /** Root path on disk where uploaded documents are stored */
  fileServer: process.env.FILE_SERVER
    ? path.resolve(process.env.FILE_SERVER)
    : "",
  subpoenaExtraction: {
    apiUrl: process.env.SUBPOENA_EXTRACTION_API_URL || "",
    timeoutMs: Number(process.env.SUBPOENA_EXTRACTION_TIMEOUT_MS) || 300000,
  },
  jwt: {
    secret: process.env.JWT_SECRET || "",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
};
