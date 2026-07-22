const { getPool } = require("../config/database");
const ApiError = require("../utils/ApiError");

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

  /**
   * Credit (positive delta) or atomically debit (negative delta).
   * Debits only succeed when unallocated_balance >= |delta|.
   */
  static async adjustUnallocatedBalance(companyUserId, delta, connection = null) {
    const db = connection || getPool();
    await this.ensureForCompany(companyUserId, connection);

    const numericDelta = Number(Number(delta || 0).toFixed(2));

    if (numericDelta < 0) {
      const amount = Math.abs(numericDelta);
      const [result] = await db.execute(
        `UPDATE company_portal_wallets
         SET unallocated_balance = unallocated_balance - :amount,
             updated_at = NOW()
         WHERE company_user_id = :companyUserId
           AND unallocated_balance >= :amount`,
        { companyUserId, amount }
      );

      if (!result.affectedRows) {
        throw new ApiError(400, "Insufficient company wallet balance", [
          {
            field: "paymentMethod",
            message:
              "Company wallet balance is too low. Top up or use card payment.",
          },
        ]);
      }
    } else if (numericDelta > 0) {
      await db.execute(
        `UPDATE company_portal_wallets
         SET unallocated_balance = unallocated_balance + :delta,
             updated_at = NOW()
         WHERE company_user_id = :companyUserId`,
        { companyUserId, delta: numericDelta }
      );
    }

    const wallet = await this.findByCompanyUserId(companyUserId, connection);
    return Number(wallet?.unallocated_balance || 0);
  }
}

module.exports = CompanyPortalWallet;
