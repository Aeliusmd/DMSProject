const mysql = require("mysql2/promise");
const config = require("./index");
const logger = require("../utils/logger");

let pool = null;

function createPool() {
  return mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  });
}

async function connectDatabase() {
  if (pool) {
    return pool;
  }

  pool = createPool();

  const connection = await pool.getConnection();
  await connection.ping();
  connection.release();

  logger.info("MySQL database connected", { database: config.db.database });

  return pool;
}

function getPool() {
  if (!pool) {
    throw new Error("Database pool is not initialized. Call connectDatabase() first.");
  }

  return pool;
}

module.exports = { connectDatabase, getPool };
