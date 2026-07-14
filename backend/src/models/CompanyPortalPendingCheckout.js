const { getPool } = require("../config/database");

class CompanyPortalPendingCheckout {
  static async create(data, connection = null) {
    const db = connection || getPool();
    const [result] = await db.execute(
      `INSERT INTO company_portal_pending_checkouts
        (company_user_id, upload_token, payload,
         subpoena_file_name, subpoena_storage_path, subpoena_file_size,
         extraction_raw, payment_amount, expires_at, created_at, updated_at)
       VALUES
        (:companyUserId, :uploadToken, :payload,
         :subpoenaFileName, :subpoenaStoragePath, :subpoenaFileSize,
         :extractionRaw, :paymentAmount, :expiresAt, NOW(), NOW())`,
      {
        companyUserId: data.companyUserId,
        uploadToken: data.uploadToken,
        payload: JSON.stringify(data.payload || {}),
        subpoenaFileName: data.subpoenaFileName || null,
        subpoenaStoragePath: data.subpoenaStoragePath || null,
        subpoenaFileSize: data.subpoenaFileSize || null,
        extractionRaw: data.extractionRaw
          ? JSON.stringify(data.extractionRaw)
          : null,
        paymentAmount: data.paymentAmount || 35,
        expiresAt: data.expiresAt,
      }
    );
    return this.findById(result.insertId, connection);
  }

  static async findById(id, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT * FROM company_portal_pending_checkouts WHERE id = :id LIMIT 1`,
      { id }
    );
    return rows[0] || null;
  }

  static async findByUploadToken(uploadToken, companyUserId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT * FROM company_portal_pending_checkouts
       WHERE upload_token = :uploadToken
         AND company_user_id = :companyUserId
       LIMIT 1`,
      { uploadToken, companyUserId }
    );
    return rows[0] || null;
  }

  static async findByCheckoutSessionId(sessionId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT * FROM company_portal_pending_checkouts
       WHERE stripe_checkout_session_id = :sessionId
       LIMIT 1`,
      { sessionId }
    );
    return rows[0] || null;
  }

  static async updatePayloadAndSession(
    id,
    { payload, sessionId, paymentAmount },
    connection = null
  ) {
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_pending_checkouts
       SET payload = :payload,
           stripe_checkout_session_id = :sessionId,
           payment_amount = :paymentAmount,
           updated_at = NOW()
       WHERE id = :id`,
      {
        id,
        payload: JSON.stringify(payload || {}),
        sessionId: sessionId || null,
        paymentAmount: paymentAmount || 35,
      }
    );
    return this.findById(id, connection);
  }

  static async deleteById(id, connection = null) {
    const db = connection || getPool();
    await db.execute(
      `DELETE FROM company_portal_pending_checkouts WHERE id = :id`,
      { id }
    );
  }
}

module.exports = CompanyPortalPendingCheckout;
