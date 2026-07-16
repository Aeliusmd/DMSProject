const { getPool } = require("../config/database");

class CompanyPortalWallet {
  static async ensureForCompany(companyUserId, connection = null) {
    const db = connection || getPool();
    await db.execute(
      `INSERT IGNORE INTO company_portal_wallets (company_user_id, unallocated_balance)
       VALUES (:companyUserId, 0)`,
      { companyUserId }
    );
    return this.findByCompanyUserId(companyUserId, connection);
  }

  static async findByCompanyUserId(companyUserId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT *
       FROM company_portal_wallets
       WHERE company_user_id = :companyUserId
       LIMIT 1`,
      { companyUserId }
    );
    return rows[0] || null;
  }

  static async adjustUnallocatedBalance(companyUserId, delta, connection = null) {
    const db = connection || getPool();
    await this.ensureForCompany(companyUserId, connection);
    await db.execute(
      `UPDATE company_portal_wallets
       SET unallocated_balance = unallocated_balance + :delta,
           updated_at = NOW()
       WHERE company_user_id = :companyUserId`,
      { companyUserId, delta }
    );

    const wallet = await this.findByCompanyUserId(companyUserId, connection);
    return Number(wallet?.unallocated_balance || 0);
  }
}

module.exports = CompanyPortalWallet;
