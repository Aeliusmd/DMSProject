const { getPool } = require("../config/database");

class AuthOtpCode {
  static async upsert({ lookupKey, email, otpHash, startTime, endTime }) {
    const pool = getPool();

    await pool.execute(
      `INSERT INTO auth_otp_codes
        (lookup_key, email, otp_hash, start_time, end_time)
       VALUES
        (:lookupKey, :email, :otpHash, :startTime, :endTime)
       ON DUPLICATE KEY UPDATE
        email = VALUES(email),
        otp_hash = VALUES(otp_hash),
        start_time = VALUES(start_time),
        end_time = VALUES(end_time)`,
      {
        lookupKey: String(lookupKey),
        email: String(email || "").trim().toLowerCase(),
        otpHash,
        startTime,
        endTime,
      }
    );
  }

  static async findByLookupKey(lookupKey) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, lookup_key, email, otp_hash, start_time, end_time
       FROM auth_otp_codes
       WHERE lookup_key = :lookupKey
       LIMIT 1`,
      { lookupKey: String(lookupKey) }
    );

    return rows[0] || null;
  }

  static async deleteByLookupKey(lookupKey) {
    const pool = getPool();

    await pool.execute(
      `DELETE FROM auth_otp_codes WHERE lookup_key = :lookupKey`,
      { lookupKey: String(lookupKey) }
    );
  }

  static async deleteExpired() {
    const pool = getPool();

    await pool.execute(`DELETE FROM auth_otp_codes WHERE end_time < NOW(3)`);
  }
}

module.exports = AuthOtpCode;
