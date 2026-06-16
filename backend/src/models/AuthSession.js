const { getPool } = require("../config/database");

class AuthSession {
  static async create({
    employeeId,
    sessionToken,
    ipAddress,
    userAgent,
    expiresAt,
  }) {
    const pool = getPool();

    const [result] = await pool.execute(
      `INSERT INTO auth_sessions
        (employee_id, session_token, trust_device, two_factor_verified,
         ip_address, user_agent, expires_at, created_at)
       VALUES
        (:employeeId, :sessionToken, 0, 0, :ipAddress, :userAgent, :expiresAt, NOW())`,
      {
        employeeId,
        sessionToken,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        expiresAt,
      }
    );

    return {
      id: result.insertId,
      employeeId,
      sessionToken,
      expiresAt,
    };
  }

  static async findBySessionToken(sessionToken) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT s.id, s.employee_id, s.session_token, s.trust_device,
              s.two_factor_verified, s.ip_address, s.user_agent,
              s.expires_at, s.created_at,
              e.name, e.logon, e.email, e.role
       FROM auth_sessions s
       INNER JOIN matrix_employees e ON e.id = s.employee_id
       WHERE s.session_token = :sessionToken
         AND s.expires_at > NOW()
         AND e.deleted_at IS NULL
         AND (e.is_terminated = 0 OR e.is_terminated IS NULL)
       LIMIT 1`,
      { sessionToken }
    );

    return rows[0] || null;
  }

  static async findById(id) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT s.id, s.employee_id, s.session_token, s.trust_device,
              s.two_factor_verified, s.expires_at, s.created_at,
              e.name, e.logon, e.email, e.role
       FROM auth_sessions s
       INNER JOIN matrix_employees e ON e.id = s.employee_id
       WHERE s.id = :id
         AND s.expires_at > NOW()
         AND e.deleted_at IS NULL
         AND (e.is_terminated = 0 OR e.is_terminated IS NULL)
       LIMIT 1`,
      { id }
    );

    return rows[0] || null;
  }

  static async markTwoFactorVerified(sessionId, { trustDevice, expiresAt }) {
    const pool = getPool();

    await pool.execute(
      `UPDATE auth_sessions
       SET two_factor_verified = 1,
           trust_device = :trustDevice,
           expires_at = :expiresAt
       WHERE id = :sessionId`,
      {
        sessionId,
        trustDevice: trustDevice ? 1 : 0,
        expiresAt,
      }
    );
  }

  static async deleteBySessionToken(sessionToken) {
    const pool = getPool();

    const [result] = await pool.execute(
      `DELETE FROM auth_sessions WHERE session_token = :sessionToken`,
      { sessionToken }
    );

    return result.affectedRows > 0;
  }

  static async deleteById(sessionId) {
    const pool = getPool();

    await pool.execute(`DELETE FROM auth_sessions WHERE id = :sessionId`, {
      sessionId,
    });
  }

  static async deleteAllByEmployeeId(employeeId) {
    const pool = getPool();

    await pool.execute(`DELETE FROM auth_sessions WHERE employee_id = :employeeId`, {
      employeeId,
    });
  }
}

module.exports = AuthSession;
