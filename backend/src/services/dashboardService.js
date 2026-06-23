/**
 * Dashboard aggregate metrics.
 */

const { getPool } = require("../config/database");

/** Matches orderService rush level 3: 21+ days since created_at */
const RUSH_LEVEL_3_MIN_DAYS = 21;

/** Outstanding invoices older than this are counted as overdue */
const OVERDUE_INVOICE_DAYS = 30;

async function getStandardInvoiceFinancials(pool) {
  const invoiceTotalSql = `
    COALESCE(i.custodian_fee, 0)
    + COALESCE(i.page_count, 0) * COALESCE(i.per_page_amount, 0)
    + COALESCE(i.clerical_time_hours, 0) * COALESCE(i.clerical_hourly_rate, 0)
    + COALESCE(i.shipping_handling, 0)
    + COALESCE(i.storage_fee, COALESCE(i.other_fee, 0))
  `;

  const [rows] = await pool.execute(
    `SELECT
      COALESCE(SUM(${invoiceTotalSql}), 0) AS total_invoiced,
      COALESCE(SUM(COALESCE(payments.paid_total, 0)), 0) AS total_paid,
      COALESCE(SUM(
        CASE
          WHEN i.status NOT IN ('Paid', 'Needs Resend', 'Written Off')
            AND GREATEST(
              0,
              (${invoiceTotalSql}) - COALESCE(payments.paid_total, 0) - COALESCE(i.writeoff_amount, 0)
            ) > 0
          THEN GREATEST(
            0,
            (${invoiceTotalSql}) - COALESCE(payments.paid_total, 0) - COALESCE(i.writeoff_amount, 0)
          )
          ELSE 0
        END
      ), 0) AS outstanding_total,
      SUM(
        CASE
          WHEN i.status NOT IN ('Paid', 'Written Off', 'Needs Resend')
            AND GREATEST(
              0,
              (${invoiceTotalSql}) - COALESCE(payments.paid_total, 0) - COALESCE(i.writeoff_amount, 0)
            ) > 0
            AND DATEDIFF(
              CURDATE(),
              DATE(COALESCE(i.sent_date, i.invoice_date))
            ) >= :overdueDays
          THEN 1
          ELSE 0
        END
      ) AS overdue_count,
      SUM(CASE WHEN i.status = 'Needs Resend' THEN 1 ELSE 0 END) AS needs_resend_count
    FROM invoices i
    LEFT JOIN (
      SELECT order_id, SUM(amount) AS paid_total
      FROM order_payments
      WHERE payment_type IN ('prepayment', 'custodian')
      GROUP BY order_id
    ) payments ON payments.order_id = i.order_id`,
    { overdueDays: OVERDUE_INVOICE_DAYS }
  );

  return rows[0] || {};
}

async function getXrayInvoiceFinancials(pool) {
  const [rows] = await pool.execute(
    `SELECT
      COALESCE(SUM(x.payment), 0) AS total_invoiced,
      COALESCE(SUM(COALESCE(op.amount, 0)), 0) AS total_paid,
      COALESCE(SUM(
        CASE
          WHEN GREATEST(0, x.payment - COALESCE(op.amount, 0)) > 0
          THEN GREATEST(0, x.payment - COALESCE(op.amount, 0))
          ELSE 0
        END
      ), 0) AS outstanding_total,
      SUM(
        CASE
          WHEN GREATEST(0, x.payment - COALESCE(op.amount, 0)) > 0
            AND DATEDIFF(
              CURDATE(),
              DATE(COALESCE(x.sent_date, x.xray_invoice_date))
            ) >= :overdueDays
          THEN 1
          ELSE 0
        END
      ) AS overdue_count,
      SUM(CASE WHEN x.sent_date IS NOT NULL THEN 1 ELSE 0 END) AS needs_resend_count
    FROM invoice_xray_details x
    INNER JOIN orders o ON o.id = x.order_id
    LEFT JOIN order_payments op
      ON op.order_id = x.order_id
     AND op.payment_type = 'xray'
    WHERE o.status NOT IN ('Cancelled', 'Deleted')`,
    { overdueDays: OVERDUE_INVOICE_DAYS }
  );

  return rows[0] || {};
}

function formatMoney(value) {
  const amount = Number(value) || 0;
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function getDashboardStats() {
  const pool = getPool();

  const [
    [orderCountRows],
    [rushCountRows],
    financialSummary,
    [unprocessedRows],
    [facilityRows],
    [reminderRows],
  ] = await Promise.all([
    pool.execute(`
      SELECT
        COUNT(*) AS total_orders,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active_cases,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed
      FROM orders
      WHERE status NOT IN ('Cancelled', 'Deleted')
    `),
    pool.execute(
      `SELECT COUNT(*) AS rush_orders
       FROM orders
       WHERE status NOT IN ('Cancelled', 'Deleted')
         AND DATEDIFF(CURDATE(), DATE(created_at)) >= :minDays`,
      { minDays: RUSH_LEVEL_3_MIN_DAYS }
    ),
    Promise.all([getStandardInvoiceFinancials(pool), getXrayInvoiceFinancials(pool)]),
    pool.execute(`
      SELECT COUNT(*) AS unprocessed_count
      FROM batch_scan_extracts e
      INNER JOIN unprocessed_subpoenas p ON p.id = e.parent_id
      WHERE e.is_deleted = 0
        AND e.is_processed = 0
        AND p.is_deleted = 0
    `),
    pool.execute(`
      SELECT COUNT(*) AS facilities_count
      FROM facilities
      WHERE is_active = 1
    `),
    pool.execute(`
      SELECT COUNT(*) AS pending_reminders
      FROM order_notes
      WHERE is_called = 0
    `),
  ]);

  const counts = orderCountRows[0] || {};
  const [standardFinancial, xrayFinancial] = financialSummary;
  const financial = {
    total_invoiced:
      (Number(standardFinancial?.total_invoiced) || 0) +
      (Number(xrayFinancial?.total_invoiced) || 0),
    total_paid:
      (Number(standardFinancial?.total_paid) || 0) +
      (Number(xrayFinancial?.total_paid) || 0),
    outstanding_total:
      (Number(standardFinancial?.outstanding_total) || 0) +
      (Number(xrayFinancial?.outstanding_total) || 0),
    overdue_count:
      (Number(standardFinancial?.overdue_count) || 0) +
      (Number(xrayFinancial?.overdue_count) || 0),
    needs_resend_count:
      (Number(standardFinancial?.needs_resend_count) || 0) +
      (Number(xrayFinancial?.needs_resend_count) || 0),
  };
  const outstanding = Number(financial.outstanding_total) || 0;
  const totalInvoiced = Number(financial.total_invoiced) || 0;
  const totalPaid = Number(financial.total_paid) || 0;

  return {
    totalOrders: Number(counts.total_orders) || 0,
    activeCases: Number(counts.active_cases) || 0,
    rushOrders: Number(rushCountRows[0]?.rush_orders) || 0,
    outstanding,
    outstandingDisplay: formatMoney(outstanding),
    unprocessed: Number(unprocessedRows[0]?.unprocessed_count) || 0,
    facilities: Number(facilityRows[0]?.facilities_count) || 0,
    pendingReminders: Number(reminderRows[0]?.pending_reminders) || 0,
    completed: Number(counts.completed) || 0,
    financial: {
      totalInvoiced,
      totalInvoicedDisplay: formatMoney(totalInvoiced),
      totalPaid,
      totalPaidDisplay: formatMoney(totalPaid),
      outstanding,
      outstandingDisplay: formatMoney(outstanding),
      overdueInvoices: Number(financial.overdue_count) || 0,
      needsResend: Number(financial.needs_resend_count) || 0,
    },
  };
}

async function getTopProviders(limit = 5) {
  const pool = getPool();
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);

  const [rows] = await pool.execute(`
    SELECT
      COALESCE(
        NULLIF(TRIM(p.company_name), ''),
        NULLIF(TRIM(o.serve_company_name), ''),
        'Unknown Provider'
      ) AS provider_name,
      COUNT(DISTINCT o.id) AS case_count,
      COALESCE(SUM(i.total_amount), 0) AS invoiced_total,
      COALESCE(SUM(i.amount_paid), 0) AS paid_total
    FROM orders o
    LEFT JOIN providers p ON p.id = o.provider_id
    LEFT JOIN invoices i ON i.order_id = o.id
    WHERE o.status NOT IN ('Cancelled', 'Deleted')
    GROUP BY provider_name
    ORDER BY case_count DESC, invoiced_total DESC, provider_name ASC
    LIMIT ${safeLimit}
  `);

  return rows.map((row) => {
    const caseCount = Number(row.case_count) || 0;

    return {
      name: row.provider_name || "Unknown Provider",
      caseCount,
      casesLabel: `${caseCount} case${caseCount === 1 ? "" : "s"}`,
      invoiced: formatMoney(row.invoiced_total),
      paid: formatMoney(row.paid_total),
    };
  });
}

module.exports = {
  getDashboardStats,
  getTopProviders,
};
