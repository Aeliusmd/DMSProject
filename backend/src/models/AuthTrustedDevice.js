const crypto = require("crypto");
const { getPool } = require("../config/database");

function hashDeviceToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

class AuthTrustedDevice {
  static hashToken(token) {
    return hashDeviceToken(token);
  }

  static async create({ employeeId, deviceToken, trustedAt, expiresAt }) {
    const pool = getPool();
    const deviceTokenHash = hashDeviceToken(deviceToken);

    await pool.execute(
      `INSERT INTO auth_trusted_devices
        (employee_id, device_token_hash, trusted_at, expires_at)
       VALUES
        (:employeeId, :deviceTokenHash, :trustedAt, :expiresAt)`,
      {
        employeeId,
        deviceTokenHash,
        trustedAt,
        expiresAt,
      }
    );

    return { employeeId, deviceTokenHash, trustedAt, expiresAt };
  }

  static async findValidByToken(deviceToken) {
    if (!deviceToken) return null;

    const pool = getPool();
    const deviceTokenHash = hashDeviceToken(deviceToken);

    const [rows] = await pool.execute(
      `SELECT id, employee_id, device_token_hash, trusted_at, expires_at
       FROM auth_trusted_devices
       WHERE device_token_hash = :deviceTokenHash
         AND expires_at > NOW(3)
       LIMIT 1`,
      { deviceTokenHash }
    );

    return rows[0] || null;
  }

  static async deleteByToken(deviceToken) {
    if (!deviceToken) return;

    const pool = getPool();
    await pool.execute(
      `DELETE FROM auth_trusted_devices WHERE device_token_hash = :deviceTokenHash`,
      { deviceTokenHash: hashDeviceToken(deviceToken) }
    );
  }

  static async deleteExpired() {
    const pool = getPool();
    await pool.execute(
      `DELETE FROM auth_trusted_devices WHERE expires_at <= NOW(3)`
    );
  }
}

module.exports = AuthTrustedDevice;
