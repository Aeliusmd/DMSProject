const path = require("path");

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",

  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "dms_db",
  },

  fileServer: process.env.FILE_SERVER
    ? path.resolve(process.env.FILE_SERVER)
    : "",
  subpoenaExtraction: {
    apiUrl: process.env.SUBPOENA_EXTRACTION_API_URL || "",
    timeoutMs: Number(process.env.SUBPOENA_EXTRACTION_TIMEOUT_MS) || 300000,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "change-me-access-secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "change-me-refresh-secret",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  session: {
    trustedDeviceDays: Number(process.env.SESSION_TRUSTED_DAYS) || 30,
    defaultDays: Number(process.env.SESSION_DEFAULT_DAYS) || 7,
  },

  twoFactor: {
    codeLength: 6,
    expiresMinutes: Number(process.env.TWO_FACTOR_EXPIRES_MINUTES) || 10,
    resendCooldownSeconds: Number(process.env.TWO_FACTOR_RESEND_COOLDOWN) || 60,
    devLogCode: process.env.TWO_FACTOR_DEV_LOG_CODE === "true",
  },

  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== "false",
    user: (process.env.SMTP_USER || "").trim(),
    pass: (process.env.SMTP_PASS || "").replace(/\s+/g, ""),
    from: (process.env.SMTP_FROM || process.env.SMTP_USER || "").trim(),
  },
};
