const { getPool } = require("../config/database");

class CompanyPortalEmployee {
  static async findByEmail(email, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT e.*, u.company_name
       FROM company_portal_employees e
       INNER JOIN company_portal_users u ON u.id = e.company_user_id
       WHERE e.email = :email
         AND e.deleted_at IS NULL
         AND u.deleted_at IS NULL
       LIMIT 1`,
      { email: `${email || ""}`.trim().toLowerCase() }
    );
    return rows[0] || null;
  }

  static async findByIdForCompany(id, companyUserId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT *
       FROM company_portal_employees
       WHERE id = :id
         AND company_user_id = :companyUserId
         AND deleted_at IS NULL
       LIMIT 1`,
      { id, companyUserId }
    );
    return rows[0] || null;
  }

  static async listForCompany(
    companyUserId,
    { search = "", limit = 100 } = {},
    connection = null
  ) {
    const db = connection || getPool();
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const term = `${search || ""}`.trim().toLowerCase();
    const params = { companyUserId };
    let searchClause = "";

    if (term) {
      searchClause = `AND (
        LOWER(name) LIKE :search
        OR LOWER(email) LIKE :search
      )`;
      params.search = `%${term}%`;
    }

    const [rows] = await db.execute(
      `SELECT id, company_user_id, name, email, wallet_balance, is_active,
              last_login_at, created_at, updated_at
       FROM company_portal_employees
       WHERE company_user_id = :companyUserId
         AND deleted_at IS NULL
         ${searchClause}
       ORDER BY name ASC, id ASC
       LIMIT ${safeLimit}`,
      params
    );
    return rows;
  }

  static async create(data, connection = null) {
    const db = connection || getPool();
    const [result] = await db.execute(
      `INSERT INTO company_portal_employees
        (company_user_id, name, email, password_hash, wallet_balance, is_active, created_at, updated_at)
       VALUES
        (:companyUserId, :name, :email, :passwordHash, 0, 1, NOW(), NOW())`,
      {
        companyUserId: data.companyUserId,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
      }
    );
    return this.findByIdForCompany(result.insertId, data.companyUserId, connection);
  }

  static async updateLastLogin(id, connection = null) {
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_employees
       SET last_login_at = NOW(), updated_at = NOW()
       WHERE id = :id`,
      { id }
    );
  }

  static async adjustWalletBalance(id, delta, connection = null) {
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_employees
       SET wallet_balance = wallet_balance + :delta,
           updated_at = NOW()
       WHERE id = :id
         AND deleted_at IS NULL`,
      { id, delta }
    );

    const [rows] = await db.execute(
      `SELECT wallet_balance
       FROM company_portal_employees
       WHERE id = :id
       LIMIT 1`,
      { id }
    );
    return Number(rows[0]?.wallet_balance || 0);
  }

  static async getAllocatedTotal(companyUserId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT COALESCE(SUM(wallet_balance), 0) AS allocated_total
       FROM company_portal_employees
       WHERE company_user_id = :companyUserId
         AND deleted_at IS NULL`,
      { companyUserId }
    );
    return Number(rows[0]?.allocated_total || 0);
  }
}

module.exports = CompanyPortalEmployee;
