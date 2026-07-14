const { getPool } = require("../config/database");

class PersonalPortalUser {
  static async findByEmail(email, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT *
       FROM personal_portal_users
       WHERE email = :email
         AND deleted_at IS NULL
       LIMIT 1`,
      { email }
    );
    return rows[0] || null;
  }

  static async findByEmailForAuth(email) {
    return this.findByEmail(email);
  }

  static async findById(id, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT *
       FROM personal_portal_users
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
      `INSERT INTO personal_portal_users
        (first_name, last_name, email, password_hash, phone, is_active, created_at, updated_at)
       VALUES
        (:firstName, :lastName, :email, :passwordHash, :phone, 1, NOW(), NOW())`,
      {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        passwordHash: data.passwordHash,
        phone: data.phone || null,
      }
    );

    return this.findById(result.insertId, connection);
  }

  static async updateLastLogin(id) {
    const pool = getPool();
    await pool.execute(
      `UPDATE personal_portal_users
       SET last_login_at = NOW(), updated_at = NOW()
       WHERE id = :id`,
      { id }
    );
  }
}

module.exports = PersonalPortalUser;
