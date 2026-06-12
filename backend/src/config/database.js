const config = require("./index");

/**
 * Database connection setup.
 * Plug in your ORM/driver here (e.g. Sequelize, Prisma, Mongoose, pg).
 */
async function connectDatabase() {
  if (!config.databaseUrl) {
    console.warn("DATABASE_URL is not set — skipping database connection.");
    return null;
  }

  // TODO: initialize database client
  return null;
}

module.exports = { connectDatabase };
