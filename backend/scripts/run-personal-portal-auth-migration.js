/**
 * Run personal portal auth migration.
 * Usage (from backend): node scripts/run-personal-portal-auth-migration.js
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = :table
       AND column_name = :column`,
    { table, column }
  );
  return Number(rows[0]?.cnt || 0) > 0;
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "dms_db",
    multipleStatements: true,
    namedPlaceholders: true,
  });

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, "..", "migrations", "add_personal_portal_auth_tables.sql"),
      "utf8"
    );

    // Split carefully: run CREATE TABLE statements, then conditional ALTER
    await connection.query(`
CREATE TABLE IF NOT EXISTS personal_portal_users (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name      VARCHAR(100)    NOT NULL,
  last_name       VARCHAR(100)    NOT NULL,
  email           VARCHAR(255)    NOT NULL,
  password_hash   VARCHAR(255)    NULL,
  phone           VARCHAR(30)     NULL,
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  last_login_at   DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_personal_portal_users_email (email),
  KEY idx_personal_portal_users_active (is_active, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("OK personal_portal_users");

    await connection.query(`
CREATE TABLE IF NOT EXISTS personal_portal_sessions (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  personal_user_id     BIGINT UNSIGNED NOT NULL,
  session_token        VARCHAR(128)    NOT NULL,
  trust_device         TINYINT(1)      NOT NULL DEFAULT 0,
  two_factor_verified  TINYINT(1)      NOT NULL DEFAULT 0,
  ip_address           VARCHAR(45)     NULL,
  user_agent           VARCHAR(512)    NULL,
  expires_at           DATETIME        NOT NULL,
  created_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_personal_portal_sessions_token (session_token),
  KEY idx_personal_portal_sessions_user (personal_user_id),
  KEY idx_personal_portal_sessions_expires (expires_at),
  CONSTRAINT fk_personal_portal_sessions_user
    FOREIGN KEY (personal_user_id) REFERENCES personal_portal_users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("OK personal_portal_sessions");

    if (!(await columnExists(connection, "personal_request_orders", "portal_user_id"))) {
      await connection.query(`
ALTER TABLE personal_request_orders
  ADD COLUMN portal_user_id BIGINT UNSIGNED NULL AFTER id,
  ADD KEY idx_pro_portal_user (portal_user_id),
  ADD CONSTRAINT fk_pro_portal_user
    FOREIGN KEY (portal_user_id) REFERENCES personal_portal_users (id)
    ON DELETE SET NULL;
      `);
      console.log("OK portal_user_id on personal_request_orders");
    } else {
      console.log("skip portal_user_id (already exists)");
    }

    console.log("\nPersonal portal auth migration applied.");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
