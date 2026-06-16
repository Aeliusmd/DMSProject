const mysql = require("mysql2/promise");
const config = require("./index");

let pool = null;

function getPool() {
  if (!pool) {
    if (!config.databaseUrl && !config.db.user) {
      throw new Error("Database is not configured");
    }
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.name,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
      dateStrings: true,
    });
  }
  return pool;
}

async function connectDatabase() {
  const p = getPool();
  const conn = await p.getConnection();
  await conn.ping();
  conn.release();
  return p;
}

async function query(sql, params) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

async function withTransaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  getPool,
  connectDatabase,
  query,
  withTransaction,
};
