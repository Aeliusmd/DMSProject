const { getPool } = require("../config/database");

const ORDER_VISIBLE = "o.status NOT IN ('Cancelled', 'Deleted')";

const STANDARD_COMPANY_CONDITION = `(
  (
    i.status NOT IN ('Paid', 'Written Off', 'Needs Resend')
    AND i.sent_date IS NULL
    AND i.amount_due > 0
  )
  OR (
    i.status <> 'Paid'
    AND i.amount_due > 0
    AND (
      i.status = 'Needs Resend'
      OR (
        i.sent_date IS NOT NULL
        AND i.status <> 'Written Off'
      )
    )
  )
)`;

const XRAY_COMPANY_CONDITION =
  "GREATEST(0, COALESCE(x.payment, 0) - COALESCE(x.amount_paid, 0)) > 0";

function escapeLike(value) {
  return `${value || ""}`.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function buildProviderCondition(providerId, params) {
  if (providerId) {
    params.providerId = providerId;
    return "o.provider_id = :providerId";
  }

  return "o.provider_id IS NULL";
}

function buildSearchCondition(search, params) {
  const trimmed = `${search || ""}`.trim();
  if (!trimmed) {
    return "";
  }

  params.searchPattern = `${escapeLike(trimmed)}%`;
  return "o.order_number LIKE :searchPattern";
}

function buildAllStandardConditions(providerId, filters = {}) {
  const params = {};
  const conditions = [
    ORDER_VISIBLE,
    "i.status <> 'Written Off'",
    buildProviderCondition(providerId, params),
    `(
      i.invoice_date IS NOT NULL
      OR COALESCE(i.page_count, 0) > 0
      OR COALESCE(i.clerical_time_hours, 0) > 0
      OR COALESCE(i.clerical_hourly_rate, 0) > 0
      OR COALESCE(i.shipping_handling, 0) > 0
      OR COALESCE(i.storage_fee, 0) > 0
    )`,
  ];

  if (filters.dateFrom) {
    conditions.push("i.invoice_date >= :dateFrom");
    params.dateFrom = filters.dateFrom;
  }

  if (filters.dateTo) {
    conditions.push("i.invoice_date <= :dateTo");
    params.dateTo = filters.dateTo;
  }

  const searchCondition = buildSearchCondition(filters.search, params);
  if (searchCondition) {
    conditions.push(searchCondition);
  }

  return { conditions, params };
}

function buildAllXrayConditions(providerId, filters = {}) {
  const params = {};
  const conditions = [
    ORDER_VISIBLE,
    buildProviderCondition(providerId, params),
    `(
      x.xray_invoice_date IS NOT NULL
      OR COALESCE(x.view_count, 0) > 0
      OR COALESCE(x.payment, 0) > 0
    )`,
  ];

  if (filters.dateFrom) {
    conditions.push("x.xray_invoice_date >= :dateFrom");
    params.dateFrom = filters.dateFrom;
  }

  if (filters.dateTo) {
    conditions.push("x.xray_invoice_date <= :dateTo");
    params.dateTo = filters.dateTo;
  }

  const searchCondition = buildSearchCondition(filters.search, params);
  if (searchCondition) {
    conditions.push(searchCondition);
  }

  return { conditions, params };
}

function buildStandardConditions(providerId, filters = {}) {
  const params = {};
  const conditions = [
    ORDER_VISIBLE,
    STANDARD_COMPANY_CONDITION,
    buildProviderCondition(providerId, params),
  ];

  if (filters.dateFrom) {
    conditions.push("i.invoice_date >= :dateFrom");
    params.dateFrom = filters.dateFrom;
  }

  if (filters.dateTo) {
    conditions.push("i.invoice_date <= :dateTo");
    params.dateTo = filters.dateTo;
  }

  const searchCondition = buildSearchCondition(filters.search, params);
  if (searchCondition) {
    conditions.push(searchCondition);
  }

  return { conditions, params };
}

function buildXrayConditions(providerId, filters = {}) {
  const params = {};
  const conditions = [
    ORDER_VISIBLE,
    XRAY_COMPANY_CONDITION,
    buildProviderCondition(providerId, params),
  ];

  if (filters.dateFrom) {
    conditions.push("x.xray_invoice_date >= :dateFrom");
    params.dateFrom = filters.dateFrom;
  }

  if (filters.dateTo) {
    conditions.push("x.xray_invoice_date <= :dateTo");
    params.dateTo = filters.dateTo;
  }

  const searchCondition = buildSearchCondition(filters.search, params);
  if (searchCondition) {
    conditions.push(searchCondition);
  }

  return { conditions, params };
}

function parseCursor(cursor) {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(String(cursor), "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    const sortDate = parsed?.sortDate ? String(parsed.sortDate) : null;
    const orderNumber = parsed?.orderNumber ? String(parsed.orderNumber) : null;
    const sourceType = parsed?.sourceType === "xray" ? "xray" : "standard";
    const sourceId = Number(parsed?.sourceId);

    if (!sortDate || !orderNumber || !Number.isFinite(sourceId) || sourceId <= 0) {
      return null;
    }

    return { sortDate, orderNumber, sourceType, sourceId };
  } catch {
    return null;
  }
}

function encodeCursor(row) {
  if (!row?.sort_date || !row?.order_number || !row?.source_id) {
    return null;
  }

  const payload = {
    sortDate: String(row.sort_date).slice(0, 10),
    orderNumber: String(row.order_number),
    sourceType: row.source_type === "xray" ? "xray" : "standard",
    sourceId: Number(row.source_id),
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function buildMergedQuery(providerId, filters = {}) {
  const standard = buildStandardConditions(providerId, filters);
  const xray = buildXrayConditions(providerId, filters);

  return {
    sql: `
      SELECT
        'standard' AS source_type,
        i.id AS source_id,
        i.invoice_date AS sort_date,
        o.order_number AS order_number
      FROM invoices i
      INNER JOIN orders o ON o.id = i.order_id
      WHERE ${standard.conditions.join(" AND ")}
      UNION ALL
      SELECT
        'xray' AS source_type,
        x.order_id AS source_id,
        x.xray_invoice_date AS sort_date,
        o.order_number AS order_number
      FROM invoice_xray_details x
      INNER JOIN orders o ON o.id = x.order_id
      WHERE ${xray.conditions.join(" AND ")}
    `,
    params: {
      ...standard.params,
      ...xray.params,
    },
  };
}

function buildKeysetCondition(cursor, params) {
  if (!cursor) {
    return "";
  }

  params.cursorSortDate = cursor.sortDate;
  params.cursorOrderNumber = cursor.orderNumber;
  params.cursorSourceType = cursor.sourceType;
  params.cursorSourceId = cursor.sourceId;

  return `WHERE (
    merged.sort_date < :cursorSortDate
    OR (
      merged.sort_date = :cursorSortDate
      AND merged.order_number > :cursorOrderNumber
    )
    OR (
      merged.sort_date = :cursorSortDate
      AND merged.order_number = :cursorOrderNumber
      AND merged.source_type > :cursorSourceType
    )
    OR (
      merged.sort_date = :cursorSortDate
      AND merged.order_number = :cursorOrderNumber
      AND merged.source_type = :cursorSourceType
      AND merged.source_id < :cursorSourceId
    )
  )`;
}

class CompanyInvoice {
  static async findByProviderKeyset(providerId, filters = {}) {
    const pool = getPool();
    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 100);
    const queryLimit = pageSize + 1;
    const cursor = parseCursor(filters.cursor);
    const mergedQuery = buildMergedQuery(providerId, filters);
    const params = { ...mergedQuery.params };
    const keysetCondition = buildKeysetCondition(cursor, params);

    const [rows] = await pool.execute(
      `
      SELECT merged.source_type, merged.source_id, merged.sort_date, merged.order_number
      FROM (${mergedQuery.sql}) merged
      ${keysetCondition}
      ORDER BY merged.sort_date DESC, merged.order_number ASC, merged.source_type ASC, merged.source_id DESC
      LIMIT ${queryLimit}
      `,
      params
    );

    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore ? encodeCursor(pageRows[pageRows.length - 1]) : null;

    return {
      rows: pageRows,
      pageSize,
      hasMore,
      nextCursor,
    };
  }

  static async getOpenSummaryByProvider(providerId, filters = {}) {
    const pool = getPool();
    const standard = buildStandardConditions(providerId, filters);
    const xray = buildXrayConditions(providerId, filters);

    const [standardRows] = await pool.execute(
      `
      SELECT
        COUNT(*) AS totalCases,
        SUM(
          CASE
            WHEN i.status <> 'Paid'
              AND i.amount_due > 0
              AND (
                i.status = 'Needs Resend'
                OR i.sent_date IS NOT NULL
              )
            THEN 1
            ELSE 0
          END
        ) AS needsResend
      FROM invoices i
      INNER JOIN orders o ON o.id = i.order_id
      WHERE ${standard.conditions.join(" AND ")}
      `,
      standard.params
    );

    const [xrayRows] = await pool.execute(
      `
      SELECT
        COUNT(*) AS totalCases,
        SUM(
          CASE
            WHEN x.sent_date IS NOT NULL
              AND GREATEST(0, COALESCE(x.payment, 0) - COALESCE(x.amount_paid, 0)) > 0
            THEN 1
            ELSE 0
          END
        ) AS needsResend
      FROM invoice_xray_details x
      INNER JOIN orders o ON o.id = x.order_id
      WHERE ${xray.conditions.join(" AND ")}
      `,
      xray.params
    );

    const standardSummary = standardRows[0] || {};
    const xraySummary = xrayRows[0] || {};

    return {
      openCases:
        Number(standardSummary.totalCases || 0) +
        Number(xraySummary.totalCases || 0),
      needsResend:
        Number(standardSummary.needsResend || 0) +
        Number(xraySummary.needsResend || 0),
    };
  }

  static async getFinancialSummaryByProvider(providerId, filters = {}) {
    const pool = getPool();
    const standard = buildAllStandardConditions(providerId, filters);
    const xray = buildAllXrayConditions(providerId, filters);

    const [standardRows] = await pool.execute(
      `
      SELECT
        COUNT(*) AS totalCases,
        SUM(COALESCE(i.total_amount, 0)) AS totalInvoiced,
        SUM(COALESCE(i.amount_paid, 0)) AS totalPaid,
        SUM(COALESCE(i.amount_due, 0)) AS totalDue
      FROM invoices i
      INNER JOIN orders o ON o.id = i.order_id
      WHERE ${standard.conditions.join(" AND ")}
      `,
      standard.params
    );

    const [xrayRows] = await pool.execute(
      `
      SELECT
        COUNT(*) AS totalCases,
        SUM(COALESCE(x.payment, 0)) AS totalInvoiced,
        SUM(COALESCE(x.amount_paid, 0)) AS totalPaid,
        SUM(
          GREATEST(0, COALESCE(x.payment, 0) - COALESCE(x.amount_paid, 0))
        ) AS totalDue
      FROM invoice_xray_details x
      INNER JOIN orders o ON o.id = x.order_id
      WHERE ${xray.conditions.join(" AND ")}
      `,
      xray.params
    );

    const standardSummary = standardRows[0] || {};
    const xraySummary = xrayRows[0] || {};

    return {
      totalCases:
        Number(standardSummary.totalCases || 0) +
        Number(xraySummary.totalCases || 0),
      totalInvoiced:
        Number(standardSummary.totalInvoiced || 0) +
        Number(xraySummary.totalInvoiced || 0),
      totalPaid:
        Number(standardSummary.totalPaid || 0) +
        Number(xraySummary.totalPaid || 0),
      totalDue:
        Number(standardSummary.totalDue || 0) + Number(xraySummary.totalDue || 0),
    };
  }

  static async getFinancialTotalsGroupedByProvider() {
    const pool = getPool();
    const standard = buildAllStandardConditions(null, {});
    const xray = buildAllXrayConditions(null, {});

    const [standardRows] = await pool.execute(
      `
      SELECT
        o.provider_id AS providerId,
        COUNT(*) AS totalCases,
        SUM(COALESCE(i.total_amount, 0)) AS totalInvoiced,
        SUM(COALESCE(i.amount_paid, 0)) AS totalPaid,
        SUM(COALESCE(i.amount_due, 0)) AS totalDue
      FROM invoices i
      INNER JOIN orders o ON o.id = i.order_id
      WHERE ${standard.conditions.join(" AND ")}
      GROUP BY o.provider_id
      `,
      standard.params
    );

    const [xrayRows] = await pool.execute(
      `
      SELECT
        o.provider_id AS providerId,
        COUNT(*) AS totalCases,
        SUM(COALESCE(x.payment, 0)) AS totalInvoiced,
        SUM(COALESCE(x.amount_paid, 0)) AS totalPaid,
        SUM(
          GREATEST(0, COALESCE(x.payment, 0) - COALESCE(x.amount_paid, 0))
        ) AS totalDue
      FROM invoice_xray_details x
      INNER JOIN orders o ON o.id = x.order_id
      WHERE ${xray.conditions.join(" AND ")}
      GROUP BY o.provider_id
      `,
      xray.params
    );

    const totalsByProvider = new Map();

    const ensureEntry = (providerId) => {
      const key = providerId == null ? "null" : String(providerId);
      if (!totalsByProvider.has(key)) {
        totalsByProvider.set(key, {
          totalCases: 0,
          totalInvoiced: 0,
          totalPaid: 0,
          totalDue: 0,
        });
      }
      return totalsByProvider.get(key);
    };

    standardRows.forEach((row) => {
      const entry = ensureEntry(row.providerId);
      entry.totalCases += Number(row.totalCases || 0);
      entry.totalInvoiced += Number(row.totalInvoiced || 0);
      entry.totalPaid += Number(row.totalPaid || 0);
      entry.totalDue += Number(row.totalDue || 0);
    });

    xrayRows.forEach((row) => {
      const entry = ensureEntry(row.providerId);
      entry.totalCases += Number(row.totalCases || 0);
      entry.totalInvoiced += Number(row.totalInvoiced || 0);
      entry.totalPaid += Number(row.totalPaid || 0);
      entry.totalDue += Number(row.totalDue || 0);
    });

    return totalsByProvider;
  }

  static async getSummaryByProvider(providerId, filters = {}) {
    const [openSummary, financialSummary] = await Promise.all([
      CompanyInvoice.getOpenSummaryByProvider(providerId, filters),
      CompanyInvoice.getFinancialSummaryByProvider(providerId, filters),
    ]);

    return {
      totalCases: financialSummary.totalCases,
      openCases: openSummary.openCases,
      needsResend: openSummary.needsResend,
      totalInvoiced: financialSummary.totalInvoiced,
      totalPaid: financialSummary.totalPaid,
      totalDue: financialSummary.totalDue,
    };
  }

  static async findCompanyReference(providerId) {
    const pool = getPool();
    const params = {};
    const providerCondition = buildProviderCondition(providerId, params);

    const [rows] = await pool.execute(
      `
      SELECT
        o.provider_id,
        p.company_name AS provider_name,
        p.email AS provider_email,
        o.serve_company_name,
        o.serve_email,
        f.facility_name,
        f.email AS facility_email
      FROM orders o
      LEFT JOIN providers p ON p.id = o.provider_id
      LEFT JOIN facilities f ON f.id = o.facility_id
      WHERE ${ORDER_VISIBLE}
        AND ${providerCondition}
      ORDER BY o.updated_at DESC
      LIMIT 1
      `,
      params
    );

    return rows[0] || null;
  }
}

module.exports = CompanyInvoice;
