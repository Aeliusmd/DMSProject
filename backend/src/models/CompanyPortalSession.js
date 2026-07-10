const { getPool } = require("../config/database");

class CompanyPortalSession {
  static async create({
    companyUserId,
    sessionToken,
    ipAddress,
    userAgent,
    expiresAt,
  }) {
    const pool = getPool();

    const [result] = await pool.execute(
      `INSERT INTO company_portal_sessions
        (company_user_id, session_token, trust_device, two_factor_verified,
         ip_address, user_agent, expires_at, created_at)
       VALUES
        (:companyUserId, :sessionToken, 0, 0, :ipAddress, :userAgent, :expiresAt, NOW())`,
      {
        companyUserId,
        sessionToken,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        expiresAt,
      }
    );

    return {
      id: result.insertId,
      companyUserId,
      sessionToken,
      expiresAt,
    };
  }

  static async findBySessionToken(sessionToken) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT s.id, s.company_user_id, s.session_token, s.trust_device,
              s.two_factor_verified, s.ip_address, s.user_agent,
              s.expires_at, s.created_at,
              u.company_name, u.email, u.phone, u.address_line1, u.address_line2,
              u.city, u.state, u.zip, u.is_active
       FROM company_portal_sessions s
       INNER JOIN company_portal_users u ON u.id = s.company_user_id
       WHERE s.session_token = :sessionToken
         AND s.expires_at > NOW()
         AND u.deleted_at IS NULL
         AND u.is_active = 1
       LIMIT 1`,
      { sessionToken }
    );

    return rows[0] || null;
  }

  static async findById(id) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT s.id, s.company_user_id, s.session_token, s.trust_device,
              s.two_factor_verified, s.expires_at, s.created_at,
              u.company_name, u.email, u.phone, u.address_line1, u.address_line2,
              u.city, u.state, u.zip, u.is_active
       FROM company_portal_sessions s
       INNER JOIN company_portal_users u ON u.id = s.company_user_id
       WHERE s.id = :id
         AND s.expires_at > NOW()
         AND u.deleted_at IS NULL
         AND u.is_active = 1
       LIMIT 1`,
      { id }
    );

    return rows[0] || null;
  }

  static async markTwoFactorVerified(sessionId, { trustDevice, expiresAt }) {
    const pool = getPool();

    await pool.execute(
      `UPDATE company_portal_sessions
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
      `DELETE FROM company_portal_sessions WHERE session_token = :sessionToken`,
      { sessionToken }
    );
    return result.affectedRows > 0;
  }

  static async deleteById(sessionId) {
    const pool = getPool();
    await pool.execute(
      `DELETE FROM company_portal_sessions WHERE id = :sessionId`,
      { sessionId }
    );
  }
}

module.exports = CompanyPortalSession;
