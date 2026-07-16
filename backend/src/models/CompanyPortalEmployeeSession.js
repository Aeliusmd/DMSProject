const { getPool } = require("../config/database");

class CompanyPortalEmployeeSession {
  static async create(data, connection = null) {
    const db = connection || getPool();
    const [result] = await db.execute(
      `INSERT INTO company_portal_employee_sessions
        (employee_id, company_user_id, session_token, trust_device, ip_address, user_agent, expires_at, created_at)
       VALUES
        (:employeeId, :companyUserId, :sessionToken, :trustDevice, :ipAddress, :userAgent, :expiresAt, NOW())`,
      {
        employeeId: data.employeeId,
        companyUserId: data.companyUserId,
        sessionToken: data.sessionToken,
        trustDevice: data.trustDevice ? 1 : 0,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        expiresAt: data.expiresAt,
      }
    );
    return this.findById(result.insertId, connection);
  }

  static async findById(id, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT s.*, e.name AS employee_name, e.email AS employee_email,
              u.company_name
       FROM company_portal_employee_sessions s
       INNER JOIN company_portal_employees e ON e.id = s.employee_id
       INNER JOIN company_portal_users u ON u.id = s.company_user_id
       WHERE s.id = :id
         AND e.deleted_at IS NULL
       LIMIT 1`,
      { id }
    );
    return rows[0] || null;
  }

  static async findBySessionToken(sessionToken, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT s.*, e.name AS employee_name, e.email AS employee_email,
              e.wallet_balance, e.is_active AS employee_is_active,
              u.company_name
       FROM company_portal_employee_sessions s
       INNER JOIN company_portal_employees e ON e.id = s.employee_id
       INNER JOIN company_portal_users u ON u.id = s.company_user_id
       WHERE s.session_token = :sessionToken
         AND s.expires_at > NOW()
         AND e.deleted_at IS NULL
       LIMIT 1`,
      { sessionToken }
    );
    return rows[0] || null;
  }

  static async deleteById(id, connection = null) {
    const db = connection || getPool();
    const [result] = await db.execute(
      `DELETE FROM company_portal_employee_sessions WHERE id = :id`,
      { id }
    );
    return result.affectedRows > 0;
  }

  static async deleteBySessionToken(sessionToken, connection = null) {
    const db = connection || getPool();
    const [result] = await db.execute(
      `DELETE FROM company_portal_employee_sessions WHERE session_token = :sessionToken`,
      { sessionToken }
    );
    return result.affectedRows > 0;
  }
}

module.exports = CompanyPortalEmployeeSession;
