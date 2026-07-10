const mysql = require("mysql2/promise");
const config = require("./index");
const logger = require("../utils/logger");
const ApiError = require("../utils/ApiError");
const { rethrowServiceError } = require("../utils/serviceErrorUtils");

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

  try {
    pool = createPool();

    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    logger.info("MySQL database connected", { database: config.db.database });

    return pool;
  } catch (error) {
    logger.error("MySQL database connection failed", {
      error: error.message,
      code: error.code,
    });
    rethrowServiceError(error);
  }
}

function getPool() {
  if (!pool) {
    throw new ApiError(503, "Database is not initialized. Call connectDatabase() first.");
  }

  return pool;
}

async function query(sql, params = {}) {
  try {
    const [rows] = await getPool().execute(sql, params);
    return rows;
  } catch (error) {
    error.sql = sql;
    rethrowServiceError(error);
  }
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
    rethrowServiceError(error);
  } finally {
    connection.release();
  }
}

module.exports = { connectDatabase, getPool, query, withTransaction };
