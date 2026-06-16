const { getPool } = require("../config/database");

class Provider {
  static async findAll() {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, company_name, address, zip_code, city, state, phone, fax, email, is_active
       FROM providers
       WHERE is_active = 1
       ORDER BY company_name ASC`
    );

    return rows;
  }

  static async findById(id) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, company_name, address, zip_code, city, state, phone, fax, email, is_active
       FROM providers
       WHERE id = :id
       LIMIT 1`,
      { id }
    );

    return rows[0] || null;
  }
}

module.exports = Provider;
