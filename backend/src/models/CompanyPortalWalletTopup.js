const { getPool } = require("../config/database");

class CompanyPortalWalletTopup {
  static async createPending(data, connection = null) {
    const db = connection || getPool();
    const [result] = await db.execute(
      `INSERT INTO company_portal_wallet_topups
        (company_user_id, amount, stripe_checkout_session_id, status, created_at, updated_at)
       VALUES
        (:companyUserId, :amount, :stripeCheckoutSessionId, 'pending', NOW(), NOW())`,
      {
        companyUserId: data.companyUserId,
        amount: data.amount,
        stripeCheckoutSessionId: data.stripeCheckoutSessionId || null,
      }
    );
    return this.findById(result.insertId, connection);
  }

  static async findById(id, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT * FROM company_portal_wallet_topups WHERE id = :id LIMIT 1`,
      { id }
    );
    return rows[0] || null;
  }

  static async findByIdForUpdate(id, connection) {
    if (!connection) {
      throw new Error("findByIdForUpdate requires a transaction connection");
    }
    const [rows] = await connection.execute(
      `SELECT * FROM company_portal_wallet_topups
       WHERE id = :id
       LIMIT 1
       FOR UPDATE`,
      { id }
    );
    return rows[0] || null;
  }

  static async findBySessionId(sessionId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT * FROM company_portal_wallet_topups
       WHERE stripe_checkout_session_id = :sessionId
       LIMIT 1`,
      { sessionId }
    );
    return rows[0] || null;
  }

  static async attachSessionId(id, sessionId, connection = null) {
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_wallet_topups
       SET stripe_checkout_session_id = :sessionId, updated_at = NOW()
       WHERE id = :id`,
      { id, sessionId }
    );
    return this.findById(id, connection);
  }

  static async markPaid(id, connection = null) {
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_wallet_topups
       SET status = 'paid', updated_at = NOW()
       WHERE id = :id`,
      { id }
    );
    return this.findById(id, connection);
  }

  /** Atomically claim a pending top-up. Returns true only for the first claimer. */
  static async markPaidIfPending(id, connection = null) {
    const db = connection || getPool();
    const [result] = await db.execute(
      `UPDATE company_portal_wallet_topups
       SET status = 'paid', updated_at = NOW()
       WHERE id = :id
         AND status = 'pending'`,
      { id }
    );
    return Number(result.affectedRows || 0) > 0;
  }
}

module.exports = CompanyPortalWalletTopup;
