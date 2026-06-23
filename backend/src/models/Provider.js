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

  static async search(query, limit = 10) {
    const pool = getPool();
    const trimmed = `${query || ""}`.trim();

    if (!trimmed) return [];

    const [rows] = await pool.execute(
      `SELECT id, company_name, address, zip_code, city, state, phone, fax, email, is_active
       FROM providers
       WHERE is_active = 1
         AND company_name LIKE :query
       ORDER BY company_name ASC
       LIMIT ${Number(limit)}`,
      { query: `%${trimmed}%` }
    );

    return rows;
  }

  static async findById(id, connection = null) {
    const db = connection || getPool();

    const [rows] = await db.execute(
      `SELECT id, company_name, address, zip_code, city, state, phone, fax, email, is_active
       FROM providers
       WHERE id = :id
       LIMIT 1`,
      { id }
    );

    return rows[0] || null;
  }

  static async findByCompanyName(companyName, connection = null) {
    const db = connection || getPool();
    const trimmed = `${companyName || ""}`.trim();

    if (!trimmed) return null;

    const [rows] = await db.execute(
      `SELECT id, company_name, address, zip_code, city, state, phone, fax, email, is_active
       FROM providers
       WHERE is_active = 1
         AND LOWER(TRIM(company_name)) = LOWER(TRIM(:companyName))
       LIMIT 1`,
      { companyName: trimmed }
    );

    return rows[0] || null;
  }

  static async create(connection, data) {
    const db = connection || getPool();

    const [result] = await db.execute(
      `INSERT INTO providers
        (company_name, address, zip_code, city, state, phone, fax, email,
         is_active, created_at, updated_at)
       VALUES
        (:companyName, :address, :zipCode, :city, :state, :phone, :fax, :email,
         1, NOW(), NOW())`,
      data
    );

    return result.insertId;
  }

  static async update(connection, id, data) {
    const db = connection || getPool();

    await db.execute(
      `UPDATE providers
       SET company_name = :companyName,
           address = :address,
           zip_code = :zipCode,
           city = :city,
           state = :state,
           phone = :phone,
           fax = :fax,
           email = :email,
           updated_at = NOW()
       WHERE id = :id
         AND is_active = 1`,
      { ...data, id }
    );
  }
}

module.exports = Provider;
