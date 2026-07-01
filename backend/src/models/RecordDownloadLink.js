const { getPool } = require("../config/database");

class RecordDownloadLink {
  static async create({ orderId, token, expiresAt }, connection = null) {
    const db = connection || getPool();

    const [result] = await db.execute(
      `INSERT INTO order_record_download_links (order_id, token, expires_at, created_at)
       VALUES (:orderId, :token, :expiresAt, NOW())`,
      { orderId, token, expiresAt }
    );

    return result.insertId;
  }

  static async findByToken(token, connection = null) {
    const db = connection || getPool();

    const [rows] = await db.execute(
      `SELECT id, order_id, token, expires_at, created_at
       FROM order_record_download_links
       WHERE token = :token
       LIMIT 1`,
      { token }
    );

    return rows[0] || null;
  }
}

module.exports = RecordDownloadLink;
