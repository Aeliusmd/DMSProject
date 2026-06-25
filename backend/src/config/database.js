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
    dateStrings: ["DATE"],
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

async function query(sql, params = {}) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

async function withTransaction(callback) {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { connectDatabase, getPool, query, withTransaction };
