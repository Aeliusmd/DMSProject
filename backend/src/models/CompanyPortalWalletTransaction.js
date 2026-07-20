const { getPool } = require("../config/database");

function encodeCreatedCursor(createdAt, id) {
  if (!createdAt || !id) return null;
  const dateValue =
    createdAt instanceof Date ? createdAt.toISOString() : String(createdAt);
  return `${dateValue}|${id}`;
}

function decodeCreatedCursor(rawCursor) {
  if (rawCursor == null || rawCursor === "") return null;

  const value = String(rawCursor);
  const separatorIndex = value.lastIndexOf("|");
  if (separatorIndex <= 0) return null;

  const createdAt = value.slice(0, separatorIndex);
  const id = Number(value.slice(separatorIndex + 1));
  if (!createdAt || !Number.isFinite(id) || id <= 0) return null;

  return { createdAt, id };
}

class CompanyPortalWalletTransaction {
  static async create(data, connection = null) {
    const db = connection || getPool();
    const [result] = await db.execute(
      `INSERT INTO company_portal_wallet_transactions
        (company_user_id, employee_id, transaction_type, amount,
         company_balance_after, employee_balance_after, description,
         order_id, stripe_checkout_session_id, created_at)
       VALUES
        (:companyUserId, :employeeId, :transactionType, :amount,
         :companyBalanceAfter, :employeeBalanceAfter, :description,
         :orderId, :stripeCheckoutSessionId, NOW())`,
      {
        companyUserId: data.companyUserId,
        employeeId: data.employeeId || null,
        transactionType: data.transactionType,
        amount: data.amount,
        companyBalanceAfter: data.companyBalanceAfter ?? null,
        employeeBalanceAfter: data.employeeBalanceAfter ?? null,
        description: data.description || null,
        orderId: data.orderId || null,
        stripeCheckoutSessionId: data.stripeCheckoutSessionId || null,
      }
    );
    return result.insertId;
  }

  static async findOrderPaymentByPortalOrderId(portalOrderId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT *
       FROM company_portal_wallet_transactions
       WHERE order_id = :portalOrderId
         AND transaction_type = 'order_payment'
         AND (description IS NULL OR description NOT LIKE '%Invoice%')
       ORDER BY id ASC
       LIMIT 1`,
      { portalOrderId }
    );
    return rows[0] || null;
  }

  static async listInvoicePaymentsForPortalOrder(portalOrderId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT *
       FROM company_portal_wallet_transactions
       WHERE order_id = :portalOrderId
         AND transaction_type = 'order_payment'
         AND description LIKE '%Invoice%'
       ORDER BY id ASC`,
      { portalOrderId }
    );
    return rows;
  }

  static async listInvoicePaymentsMissingOnlineRecord(limit = 100) {
    const db = getPool();
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const [rows] = await db.execute(
      `SELECT
         t.id AS wallet_tx_id,
         t.amount,
         t.description,
         t.created_at,
         cpo.id AS portal_order_id,
         cpo.internal_order_id,
         cpo.order_number,
         cpo.contact_email,
         cpo.company_name
       FROM company_portal_wallet_transactions t
       INNER JOIN company_portal_orders cpo ON cpo.id = t.order_id
       WHERE t.transaction_type = 'order_payment'
         AND t.description LIKE '%Invoice%'
         AND cpo.internal_order_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM stripe_online_payments s
           WHERE s.order_id = cpo.internal_order_id
             AND s.payment_method_type = 'wallet'
             AND s.status = 'succeeded'
             AND s.stripe_payment_intent_id = CONCAT(
               'wallet_inv_', t.id, '_',
               CASE
                 WHEN LOWER(t.description) LIKE '%x-ray%' OR LOWER(t.description) LIKE '%xray%'
                   THEN 'xray'
                 ELSE 'regular'
               END
             )
         )
       ORDER BY t.id ASC
       LIMIT ${safeLimit}`
    );
    return rows;
  }

  static async listForCompany(
    companyUserId,
    { limit = 50 } = {},
    connection = null
  ) {
    const db = connection || getPool();
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const [rows] = await db.execute(
      `SELECT t.*, e.name AS employee_name
       FROM company_portal_wallet_transactions t
       LEFT JOIN company_portal_employees e ON e.id = t.employee_id
       WHERE t.company_user_id = :companyUserId
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT ${safeLimit}`,
      { companyUserId }
    );
    return rows;
  }

  static async listForCompanyKeyset(
    companyUserId,
    { cursor = null, pageSize = 10 } = {},
    connection = null
  ) {
    const db = connection || getPool();
    const safePageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 50);
    const queryLimit = safePageSize + 1;
    const params = { companyUserId };
    let cursorCondition = "";

    const decoded = decodeCreatedCursor(cursor);
    if (decoded) {
      cursorCondition = `AND (
        t.created_at < :cursorCreatedAt
        OR (
          t.created_at = :cursorCreatedAt
          AND t.id < :cursorId
        )
      )`;
      params.cursorCreatedAt = decoded.createdAt;
      params.cursorId = decoded.id;
    }

    const [rows] = await db.execute(
      `SELECT t.*, e.name AS employee_name
       FROM company_portal_wallet_transactions t
       LEFT JOIN company_portal_employees e ON e.id = t.employee_id
       WHERE t.company_user_id = :companyUserId
         ${cursorCondition}
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT ${queryLimit}`,
      params
    );

    const hasMore = rows.length > safePageSize;
    const pageRows = hasMore ? rows.slice(0, safePageSize) : rows;
    const lastRow = pageRows[pageRows.length - 1] || null;

    return {
      rows: pageRows,
      pageSize: safePageSize,
      hasMore,
      nextCursor:
        hasMore && lastRow
          ? encodeCreatedCursor(lastRow.created_at, lastRow.id)
          : null,
    };
  }
}

module.exports = CompanyPortalWalletTransaction;
