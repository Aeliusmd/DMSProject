const { getPool } = require("../config/database");

class CompanyPortalUser {
  static async findByEmail(email, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT *
       FROM company_portal_users
       WHERE email = :email
         AND deleted_at IS NULL
       LIMIT 1`,
      { email }
    );
    return rows[0] || null;
  }

  static async findByEmailForAuth(email) {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT *
       FROM company_portal_users
       WHERE email = :email
         AND deleted_at IS NULL
       LIMIT 1`,
      { email }
    );
    return rows[0] || null;
  }

  static async findById(id, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT *
       FROM company_portal_users
       WHERE id = :id
         AND deleted_at IS NULL
       LIMIT 1`,
      { id }
    );
    return rows[0] || null;
  }

  static async create(data, connection = null) {
    const db = connection || getPool();
    const [result] = await db.execute(
      `INSERT INTO company_portal_users
        (company_name, phone, email, password_hash, address_line1, address_line2,
         city, state, zip, is_active, created_at, updated_at)
       VALUES
        (:companyName, :phone, :email, :passwordHash, :addressLine1, :addressLine2,
         :city, :state, :zip, 1, NOW(), NOW())`,
      {
        companyName: data.companyName,
        phone: data.phone,
        email: data.email,
        passwordHash: data.passwordHash,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        city: data.city,
        state: data.state,
        zip: data.zip,
      }
    );

    return this.findById(result.insertId, connection);
  }

  static async updateLastLogin(id) {
    const pool = getPool();
    await pool.execute(
      `UPDATE company_portal_users
       SET last_login_at = NOW(), updated_at = NOW()
       WHERE id = :id`,
      { id }
    );
  }
}

module.exports = CompanyPortalUser;
