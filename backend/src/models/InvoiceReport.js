const { getPool } = require("../config/database");
const { likePrefix } = require("../utils/sqlSafety");

const ORDER_VISIBLE = "o.status NOT IN ('Cancelled', 'Deleted')";

const STANDARD_OUTSTANDING_CONDITIONS = [
  ORDER_VISIBLE,
  "i.status NOT IN ('Paid', 'Written Off', 'Needs Resend')",
  "i.sent_date IS NULL",
  "i.amount_due > 0",
];

const STANDARD_RESEND_CONDITIONS = [
  ORDER_VISIBLE,
  "i.status <> 'Paid'",
  "i.amount_due > 0",
  `(
    i.status = 'Needs Resend'
    OR (
      i.sent_date IS NOT NULL
      AND i.status <> 'Written Off'
    )
  )`,
];

const XRAY_AMOUNT_DUE_EXPR =
  "GREATEST(0, COALESCE(x.payment, 0) - COALESCE(x.amount_paid, 0) - COALESCE(x.writeoff_amount, 0))";

const XRAY_OUTSTANDING_CONDITIONS = [
  ORDER_VISIBLE,
  "x.status <> 'Written Off'",
  "x.sent_date IS NULL",
  `${XRAY_AMOUNT_DUE_EXPR} > 0`,
];

const XRAY_RESEND_CONDITIONS = [
  ORDER_VISIBLE,
  "x.status <> 'Written Off'",
  "x.sent_date IS NOT NULL",
  `${XRAY_AMOUNT_DUE_EXPR} > 0`,
];

function appendDateFilters(conditions, filters, dateColumn, params) {
  if (filters.dateFrom) {
    conditions.push(`${dateColumn} >= :dateFrom`);
    params.dateFrom = filters.dateFrom;
  }
  if (filters.dateTo) {
    conditions.push(`${dateColumn} <= :dateTo`);
    params.dateTo = filters.dateTo;
  }
}

function buildSearchFilter(filters = {}, params) {
  const trimmed = `${filters.search || ""}`.trim();
  if (!trimmed) return "";
  params.searchPattern = likePrefix(trimmed);
  return "o.order_number LIKE :searchPattern";
}

function encodeCursor(values) {
  return Buffer.from(JSON.stringify(values)).toString("base64url");
}

function parseCursor(cursor, keys) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(String(cursor), "base64url").toString("utf8")
    );
    const result = {};
    for (const key of keys) {
      const value = parsed?.[key];
      if (value === undefined || value === null || `${value}`.trim() === "") {
        return null;
      }
      result[key] = value;
    }
    return result;
  } catch {
    return null;
  }
}

function buildAscKeysetCondition(sortFields, cursor, params) {
  if (!cursor) return "";

  const branches = [];
  for (let index = 0; index < sortFields.length; index += 1) {
    const equals = sortFields
      .slice(0, index)
      .map((field, eqIndex) => `${field.column} = :cursor_${eqIndex}`);
    const greater = `${sortFields[index].column} > :cursor_${index}`;
    const paramKey = `cursor_${index}`;
    params[paramKey] = cursor[sortFields[index].key];

    branches.push(
      equals.length ? `(${equals.join(" AND ")} AND ${greater})` : greater
    );
  }

  return `AND (${branches.join(" OR ")})`;
}

async function runKeysetQuery({
  selectSql,
  whereClause,
  orderBy,
  sortFields,
  cursorKeys,
  filters,
  pageSize,
}) {
  const pool = getPool();
  const queryLimit = pageSize + 1;
  const params = { ...whereClause.params };
  const cursor = parseCursor(filters.cursor, cursorKeys);
  const keysetCondition = buildAscKeysetCondition(sortFields, cursor, params);
  const searchCondition = buildSearchFilter(filters, params);
  const conditions = [...whereClause.conditions];
  if (searchCondition) conditions.push(searchCondition);
  appendCompanyGroupFilter(conditions, params, filters.companyGroupKey);

  const [rows] = await pool.execute(
    `
    ${selectSql}
    WHERE ${conditions.join(" AND ")}
    ${keysetCondition}
    ORDER BY ${orderBy}
    LIMIT ${queryLimit}
    `,
    params
  );

  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor = hasMore
    ? encodeCursor(
        sortFields.reduce((acc, field) => {
          const raw = lastRow[field.alias];
          if (field.key === "invoiceDate" && raw) {
            acc[field.key] = String(raw).slice(0, 10);
          } else if (field.key === "sourceId") {
            acc[field.key] = Number(raw);
          } else {
            acc[field.key] = raw;
          }
          return acc;
        }, {})
      )
    : null;

  return { rows: pageRows, pageSize, hasMore, nextCursor };
}

async function runSummaryQuery({ fromClause, conditions, params, amountColumns }) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `
    SELECT
      COUNT(*) AS totalCases,
      COUNT(DISTINCT o.provider_id) AS totalCompanies,
      SUM(${amountColumns.invoiced}) AS totalInvoiced,
      SUM(${amountColumns.paid}) AS totalPaid,
      SUM(${amountColumns.due}) AS totalDue
    ${fromClause}
    WHERE ${conditions.join(" AND ")}
    `,
    params
  );

  const summary = rows[0] || {};
  return {
    totalCases: Number(summary.totalCases) || 0,
    totalCompanies: Number(summary.totalCompanies) || 0,
    totalInvoiced: Number(summary.totalInvoiced) || 0,
    totalPaid: Number(summary.totalPaid) || 0,
    totalDue: Number(summary.totalDue) || 0,
  };
}

function buildStandardWhere(baseConditions, filters = {}) {
  const params = {};
  const conditions = [...baseConditions];
  appendDateFilters(conditions, filters, "i.invoice_date", params);
  return { conditions, params };
}

function buildXrayWhere(baseConditions, filters = {}) {
  const params = {};
  const conditions = [...baseConditions];
  appendDateFilters(conditions, filters, "x.xray_invoice_date", params);
  return { conditions, params };
}

const COMPANY_PARTITION = "COALESCE(NULLIF(o.provider_id, 0), -f.id)";
const COMPANY_NAME_EXPR =
  "COALESCE(NULLIF(TRIM(p.company_name), ''), NULLIF(TRIM(o.serve_company_name), ''), f.facility_name)";
const STANDARD_COMPANY_EMAIL_EXPR =
  "COALESCE(NULLIF(TRIM(p.email), ''), NULLIF(TRIM(i.recipient_emails), ''), NULLIF(TRIM(o.serve_email), ''), NULLIF(TRIM(f.email), ''))";
const XRAY_COMPANY_EMAIL_EXPR =
  "COALESCE(NULLIF(TRIM(p.email), ''), NULLIF(TRIM(x.recipient_emails), ''), NULLIF(TRIM(o.serve_email), ''), NULLIF(TRIM(f.email), ''))";

function appendCompanyGroupFilter(conditions, params, companyGroupKey) {
  if (
    companyGroupKey === undefined ||
    companyGroupKey === null ||
    `${companyGroupKey}`.trim() === ""
  ) {
    return;
  }

  const key = Number(companyGroupKey);
  if (!Number.isFinite(key)) return;

  if (key > 0) {
    conditions.push("o.provider_id = :companyGroupKey");
    params.companyGroupKey = key;
    return;
  }

  conditions.push("(o.provider_id IS NULL OR o.provider_id = 0)");
  conditions.push("f.id = :companyFacilityId");
  params.companyFacilityId = Math.abs(key);
}

function buildCursorFromRow(row, sortFields) {
  return encodeCursor(
    sortFields.reduce((acc, field) => {
      const raw = row[field.alias];
      if (field.key === "invoiceDate" && raw) {
        acc[field.key] = String(raw).slice(0, 10);
      } else if (field.key === "sourceId") {
        acc[field.key] = Number(raw);
      } else {
        acc[field.key] = raw;
      }
      return acc;
    }, {})
  );
}

async function runFirstPerCompanyQuery({
  fromClause,
  whereClause,
  partitionOrderBy,
  sortFields,
  amountColumns,
  filters,
}) {
  const pool = getPool();
  const params = { ...whereClause.params };
  const searchCondition = buildSearchFilter(filters, params);
  const conditions = [...whereClause.conditions];
  if (searchCondition) conditions.push(searchCondition);

  const [rows] = await pool.execute(
    `
    WITH filtered AS (
      SELECT
        source_id,
        company_partition,
        company_name,
        company_email,
        facility_name,
        invoice_date,
        order_number,
        ROW_NUMBER() OVER (
          PARTITION BY company_partition
          ORDER BY ${partitionOrderBy}
        ) AS row_num,
        COUNT(*) OVER (PARTITION BY company_partition) AS company_case_count,
        SUM(company_invoiced) OVER (PARTITION BY company_partition) AS company_invoiced,
        SUM(company_paid) OVER (PARTITION BY company_partition) AS company_paid,
        SUM(company_due) OVER (PARTITION BY company_partition) AS company_due
      FROM (
        SELECT
          ${fromClause.selectColumns},
          ${COMPANY_PARTITION} AS company_partition,
          ${COMPANY_NAME_EXPR} AS company_name,
          ${fromClause.emailExpr} AS company_email,
          ${amountColumns.invoiced} AS company_invoiced,
          ${amountColumns.paid} AS company_paid,
          ${amountColumns.due} AS company_due
        ${fromClause.joins}
        WHERE ${conditions.join(" AND ")}
      ) base_rows
    )
    SELECT *
    FROM filtered
    WHERE row_num <= :pageSize
    ORDER BY company_name ASC, row_num ASC
    `,
    { ...params, pageSize: Math.min(Math.max(Number(filters.pageSize) || 10, 1), 100) }
  );

  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 100);

  return rows.map((row) => {
    const totalCases = Number(row.company_case_count) || 0;
    const hasMore = totalCases > pageSize;
    const cursorRow = {
      facility_name: row.facility_name,
      invoice_date: row.invoice_date,
      order_number: row.order_number,
      source_id: row.source_id,
    };

    return {
      ...row,
      company_case_count: totalCases,
      hasMore,
      nextCursor: hasMore ? buildCursorFromRow(cursorRow, sortFields) : null,
    };
  });
}

async function runCompanyTotalsQuery({
  fromClause,
  whereClause,
  amountColumns,
  filters,
  companyGroupKey,
}) {
  const pool = getPool();
  const params = { ...whereClause.params };
  const searchCondition = buildSearchFilter(filters, params);
  const conditions = [...whereClause.conditions];
  if (searchCondition) conditions.push(searchCondition);
  appendCompanyGroupFilter(conditions, params, companyGroupKey);

  const [rows] = await pool.execute(
    `
    SELECT
      COUNT(*) AS totalCases,
      SUM(${amountColumns.invoiced}) AS totalInvoiced,
      SUM(${amountColumns.paid}) AS totalPaid,
      SUM(${amountColumns.due}) AS totalDue,
      MAX(${COMPANY_NAME_EXPR}) AS company_name,
      MAX(${fromClause.emailExpr}) AS company_email
    ${fromClause.joins}
    WHERE ${conditions.join(" AND ")}
    `,
    params
  );

  const summary = rows[0] || {};
  return {
    totalCases: Number(summary.totalCases) || 0,
    totalInvoiced: Number(summary.totalInvoiced) || 0,
    totalPaid: Number(summary.totalPaid) || 0,
    totalDue: Number(summary.totalDue) || 0,
    companyName: summary.company_name || "Unknown Company",
    companyEmail: summary.company_email || "",
  };
}

class InvoiceReport {
  static async findStandardOutstandingFirstPerCompany(filters = {}) {
    const whereClause = buildStandardWhere(STANDARD_OUTSTANDING_CONDITIONS, filters);
    const sortFields = [
      { column: "f.facility_name", key: "facilityName", alias: "facility_name" },
      { column: "i.invoice_date", key: "invoiceDate", alias: "invoice_date" },
      { column: "o.order_number", key: "orderNumber", alias: "order_number" },
      { column: "i.id", key: "sourceId", alias: "source_id" },
    ];

    return runFirstPerCompanyQuery({
      fromClause: {
        selectColumns: `
          i.id AS source_id,
          f.facility_name,
          i.invoice_date,
          o.order_number
        `,
        emailExpr: STANDARD_COMPANY_EMAIL_EXPR,
        joins: `
          FROM invoices i
          INNER JOIN orders o ON o.id = i.order_id
          INNER JOIN facilities f ON f.id = i.facility_id
          LEFT JOIN providers p ON p.id = o.provider_id
        `,
      },
      whereClause,
      partitionOrderBy:
        "facility_name ASC, invoice_date ASC, order_number ASC, source_id ASC",
      sortFields,
      amountColumns: {
        invoiced: "COALESCE(i.total_amount, 0)",
        paid: "COALESCE(i.amount_paid, 0)",
        due: "COALESCE(i.amount_due, 0)",
      },
      filters,
    });
  }

  static async findStandardResendFirstPerCompany(filters = {}) {
    const whereClause = buildStandardWhere(STANDARD_RESEND_CONDITIONS, filters);
    const sortFields = [
      { column: "i.invoice_date", key: "invoiceDate", alias: "invoice_date" },
      { column: "f.facility_name", key: "facilityName", alias: "facility_name" },
      { column: "o.order_number", key: "orderNumber", alias: "order_number" },
      { column: "i.id", key: "sourceId", alias: "source_id" },
    ];

    return runFirstPerCompanyQuery({
      fromClause: {
        selectColumns: `
          i.id AS source_id,
          f.facility_name,
          i.invoice_date,
          o.order_number
        `,
        emailExpr: STANDARD_COMPANY_EMAIL_EXPR,
        joins: `
          FROM invoices i
          INNER JOIN orders o ON o.id = i.order_id
          INNER JOIN facilities f ON f.id = i.facility_id
          LEFT JOIN providers p ON p.id = o.provider_id
        `,
      },
      whereClause,
      partitionOrderBy:
        "invoice_date ASC, facility_name ASC, order_number ASC, source_id ASC",
      sortFields,
      amountColumns: {
        invoiced: "COALESCE(i.total_amount, 0)",
        paid: "COALESCE(i.amount_paid, 0)",
        due: "COALESCE(i.amount_due, 0)",
      },
      filters,
    });
  }

  static async findXrayOutstandingFirstPerCompany(filters = {}) {
    const whereClause = buildXrayWhere(XRAY_OUTSTANDING_CONDITIONS, filters);
    const sortFields = [
      { column: "f.facility_name", key: "facilityName", alias: "facility_name" },
      { column: "x.xray_invoice_date", key: "invoiceDate", alias: "invoice_date" },
      { column: "o.order_number", key: "orderNumber", alias: "order_number" },
      { column: "x.order_id", key: "sourceId", alias: "source_id" },
    ];

    return runFirstPerCompanyQuery({
      fromClause: {
        selectColumns: `
          x.order_id AS source_id,
          f.facility_name,
          x.xray_invoice_date AS invoice_date,
          o.order_number
        `,
        emailExpr: XRAY_COMPANY_EMAIL_EXPR,
        joins: `
          FROM invoice_xray_details x
          INNER JOIN orders o ON o.id = x.order_id
          INNER JOIN facilities f ON f.id = o.facility_id
          LEFT JOIN providers p ON p.id = o.provider_id
        `,
      },
      whereClause,
      partitionOrderBy:
        "facility_name ASC, invoice_date ASC, order_number ASC, source_id ASC",
      sortFields,
      amountColumns: {
        invoiced: "COALESCE(x.payment, 0)",
        paid: "COALESCE(x.amount_paid, 0)",
        due: XRAY_AMOUNT_DUE_EXPR,
      },
      filters,
    });
  }

  static async findXrayResendFirstPerCompany(filters = {}) {
    const whereClause = buildXrayWhere(XRAY_RESEND_CONDITIONS, filters);
    const sortFields = [
      { column: "x.xray_invoice_date", key: "invoiceDate", alias: "invoice_date" },
      { column: "f.facility_name", key: "facilityName", alias: "facility_name" },
      { column: "o.order_number", key: "orderNumber", alias: "order_number" },
      { column: "x.order_id", key: "sourceId", alias: "source_id" },
    ];

    return runFirstPerCompanyQuery({
      fromClause: {
        selectColumns: `
          x.order_id AS source_id,
          f.facility_name,
          x.xray_invoice_date AS invoice_date,
          o.order_number
        `,
        emailExpr: XRAY_COMPANY_EMAIL_EXPR,
        joins: `
          FROM invoice_xray_details x
          INNER JOIN orders o ON o.id = x.order_id
          INNER JOIN facilities f ON f.id = o.facility_id
          LEFT JOIN providers p ON p.id = o.provider_id
        `,
      },
      whereClause,
      partitionOrderBy:
        "invoice_date ASC, facility_name ASC, order_number ASC, source_id ASC",
      sortFields,
      amountColumns: {
        invoiced: "COALESCE(x.payment, 0)",
        paid: "COALESCE(x.amount_paid, 0)",
        due: XRAY_AMOUNT_DUE_EXPR,
      },
      filters,
    });
  }

  static async getStandardOutstandingCompanyTotals(filters = {}, companyGroupKey) {
    const whereClause = buildStandardWhere(STANDARD_OUTSTANDING_CONDITIONS, filters);
    return runCompanyTotalsQuery({
      fromClause: {
        emailExpr: STANDARD_COMPANY_EMAIL_EXPR,
        joins: `
          FROM invoices i
          INNER JOIN orders o ON o.id = i.order_id
          INNER JOIN facilities f ON f.id = i.facility_id
          LEFT JOIN providers p ON p.id = o.provider_id
        `,
      },
      whereClause,
      amountColumns: {
        invoiced: "COALESCE(i.total_amount, 0)",
        paid: "COALESCE(i.amount_paid, 0)",
        due: "COALESCE(i.amount_due, 0)",
      },
      filters,
      companyGroupKey,
    });
  }

  static async getStandardResendCompanyTotals(filters = {}, companyGroupKey) {
    const whereClause = buildStandardWhere(STANDARD_RESEND_CONDITIONS, filters);
    return runCompanyTotalsQuery({
      fromClause: {
        emailExpr: STANDARD_COMPANY_EMAIL_EXPR,
        joins: `
          FROM invoices i
          INNER JOIN orders o ON o.id = i.order_id
          INNER JOIN facilities f ON f.id = i.facility_id
          LEFT JOIN providers p ON p.id = o.provider_id
        `,
      },
      whereClause,
      amountColumns: {
        invoiced: "COALESCE(i.total_amount, 0)",
        paid: "COALESCE(i.amount_paid, 0)",
        due: "COALESCE(i.amount_due, 0)",
      },
      filters,
      companyGroupKey,
    });
  }

  static async getXrayOutstandingCompanyTotals(filters = {}, companyGroupKey) {
    const whereClause = buildXrayWhere(XRAY_OUTSTANDING_CONDITIONS, filters);
    return runCompanyTotalsQuery({
      fromClause: {
        emailExpr: XRAY_COMPANY_EMAIL_EXPR,
        joins: `
          FROM invoice_xray_details x
          INNER JOIN orders o ON o.id = x.order_id
          INNER JOIN facilities f ON f.id = o.facility_id
          LEFT JOIN providers p ON p.id = o.provider_id
        `,
      },
      whereClause,
      amountColumns: {
        invoiced: "COALESCE(x.payment, 0)",
        paid: "COALESCE(x.amount_paid, 0)",
        due: XRAY_AMOUNT_DUE_EXPR,
      },
      filters,
      companyGroupKey,
    });
  }

  static async getXrayResendCompanyTotals(filters = {}, companyGroupKey) {
    const whereClause = buildXrayWhere(XRAY_RESEND_CONDITIONS, filters);
    return runCompanyTotalsQuery({
      fromClause: {
        emailExpr: XRAY_COMPANY_EMAIL_EXPR,
        joins: `
          FROM invoice_xray_details x
          INNER JOIN orders o ON o.id = x.order_id
          INNER JOIN facilities f ON f.id = o.facility_id
          LEFT JOIN providers p ON p.id = o.provider_id
        `,
      },
      whereClause,
      amountColumns: {
        invoiced: "COALESCE(x.payment, 0)",
        paid: "COALESCE(x.amount_paid, 0)",
        due: XRAY_AMOUNT_DUE_EXPR,
      },
      filters,
      companyGroupKey,
    });
  }

  static async findStandardOutstandingKeyset(filters = {}) {
    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 100);
    const whereClause = buildStandardWhere(STANDARD_OUTSTANDING_CONDITIONS, filters);
    const sortFields = [
      { column: "f.facility_name", key: "facilityName", alias: "facility_name" },
      { column: "i.invoice_date", key: "invoiceDate", alias: "invoice_date" },
      { column: "o.order_number", key: "orderNumber", alias: "order_number" },
      { column: "i.id", key: "sourceId", alias: "source_id" },
    ];

    return runKeysetQuery({
      selectSql: `
        SELECT
          i.id AS source_id,
          f.facility_name,
          i.invoice_date,
          o.order_number
        FROM invoices i
        INNER JOIN orders o ON o.id = i.order_id
        INNER JOIN facilities f ON f.id = i.facility_id
      `,
      whereClause,
      orderBy:
        "f.facility_name ASC, i.invoice_date ASC, o.order_number ASC, i.id ASC",
      sortFields,
      cursorKeys: ["facilityName", "invoiceDate", "orderNumber", "sourceId"],
      filters,
      pageSize,
    });
  }

  static async findStandardResendKeyset(filters = {}) {
    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 100);
    const whereClause = buildStandardWhere(STANDARD_RESEND_CONDITIONS, filters);
    const sortFields = [
      { column: "i.invoice_date", key: "invoiceDate", alias: "invoice_date" },
      { column: "f.facility_name", key: "facilityName", alias: "facility_name" },
      { column: "o.order_number", key: "orderNumber", alias: "order_number" },
      { column: "i.id", key: "sourceId", alias: "source_id" },
    ];

    return runKeysetQuery({
      selectSql: `
        SELECT
          i.id AS source_id,
          i.invoice_date,
          f.facility_name,
          o.order_number
        FROM invoices i
        INNER JOIN orders o ON o.id = i.order_id
        INNER JOIN facilities f ON f.id = i.facility_id
      `,
      whereClause,
      orderBy:
        "i.invoice_date ASC, f.facility_name ASC, o.order_number ASC, i.id ASC",
      sortFields,
      cursorKeys: ["invoiceDate", "facilityName", "orderNumber", "sourceId"],
      filters,
      pageSize,
    });
  }

  static async findXrayOutstandingKeyset(filters = {}) {
    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 100);
    const whereClause = buildXrayWhere(XRAY_OUTSTANDING_CONDITIONS, filters);
    const sortFields = [
      { column: "f.facility_name", key: "facilityName", alias: "facility_name" },
      {
        column: "x.xray_invoice_date",
        key: "invoiceDate",
        alias: "invoice_date",
      },
      { column: "o.order_number", key: "orderNumber", alias: "order_number" },
      { column: "x.order_id", key: "sourceId", alias: "source_id" },
    ];

    return runKeysetQuery({
      selectSql: `
        SELECT
          x.order_id AS source_id,
          f.facility_name,
          x.xray_invoice_date AS invoice_date,
          o.order_number
        FROM invoice_xray_details x
        INNER JOIN orders o ON o.id = x.order_id
        INNER JOIN facilities f ON f.id = o.facility_id
      `,
      whereClause,
      orderBy:
        "f.facility_name ASC, x.xray_invoice_date ASC, o.order_number ASC, x.order_id ASC",
      sortFields,
      cursorKeys: ["facilityName", "invoiceDate", "orderNumber", "sourceId"],
      filters,
      pageSize,
    });
  }

  static async findXrayResendKeyset(filters = {}) {
    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 100);
    const whereClause = buildXrayWhere(XRAY_RESEND_CONDITIONS, filters);
    const sortFields = [
      {
        column: "x.xray_invoice_date",
        key: "invoiceDate",
        alias: "invoice_date",
      },
      { column: "f.facility_name", key: "facilityName", alias: "facility_name" },
      { column: "o.order_number", key: "orderNumber", alias: "order_number" },
      { column: "x.order_id", key: "sourceId", alias: "source_id" },
    ];

    return runKeysetQuery({
      selectSql: `
        SELECT
          x.order_id AS source_id,
          x.xray_invoice_date AS invoice_date,
          f.facility_name,
          o.order_number
        FROM invoice_xray_details x
        INNER JOIN orders o ON o.id = x.order_id
        INNER JOIN facilities f ON f.id = o.facility_id
      `,
      whereClause,
      orderBy:
        "x.xray_invoice_date ASC, f.facility_name ASC, o.order_number ASC, x.order_id ASC",
      sortFields,
      cursorKeys: ["invoiceDate", "facilityName", "orderNumber", "sourceId"],
      filters,
      pageSize,
    });
  }

  static async getStandardOutstandingSummary(filters = {}) {
    const whereClause = buildStandardWhere(STANDARD_OUTSTANDING_CONDITIONS, filters);
    const params = { ...whereClause.params };
    const searchCondition = buildSearchFilter(filters, params);
    const conditions = [...whereClause.conditions];
    if (searchCondition) conditions.push(searchCondition);

    return runSummaryQuery({
      fromClause: `
        FROM invoices i
        INNER JOIN orders o ON o.id = i.order_id
        INNER JOIN facilities f ON f.id = i.facility_id
      `,
      conditions,
      params,
      amountColumns: {
        invoiced: "COALESCE(i.total_amount, 0)",
        paid: "COALESCE(i.amount_paid, 0)",
        due: "COALESCE(i.amount_due, 0)",
      },
    });
  }

  static async getStandardResendSummary(filters = {}) {
    const whereClause = buildStandardWhere(STANDARD_RESEND_CONDITIONS, filters);
    const params = { ...whereClause.params };
    const searchCondition = buildSearchFilter(filters, params);
    const conditions = [...whereClause.conditions];
    if (searchCondition) conditions.push(searchCondition);

    return runSummaryQuery({
      fromClause: `
        FROM invoices i
        INNER JOIN orders o ON o.id = i.order_id
        INNER JOIN facilities f ON f.id = i.facility_id
      `,
      conditions,
      params,
      amountColumns: {
        invoiced: "COALESCE(i.total_amount, 0)",
        paid: "COALESCE(i.amount_paid, 0)",
        due: "COALESCE(i.amount_due, 0)",
      },
    });
  }

  static async getXrayOutstandingSummary(filters = {}) {
    const whereClause = buildXrayWhere(XRAY_OUTSTANDING_CONDITIONS, filters);
    const params = { ...whereClause.params };
    const searchCondition = buildSearchFilter(filters, params);
    const conditions = [...whereClause.conditions];
    if (searchCondition) conditions.push(searchCondition);

    return runSummaryQuery({
      fromClause: `
        FROM invoice_xray_details x
        INNER JOIN orders o ON o.id = x.order_id
        INNER JOIN facilities f ON f.id = o.facility_id
      `,
      conditions,
      params,
      amountColumns: {
        invoiced: "COALESCE(x.payment, 0)",
        paid: "COALESCE(x.amount_paid, 0)",
        due: XRAY_AMOUNT_DUE_EXPR,
      },
    });
  }

  static async getXrayResendSummary(filters = {}) {
    const whereClause = buildXrayWhere(XRAY_RESEND_CONDITIONS, filters);
    const params = { ...whereClause.params };
    const searchCondition = buildSearchFilter(filters, params);
    const conditions = [...whereClause.conditions];
    if (searchCondition) conditions.push(searchCondition);

    return runSummaryQuery({
      fromClause: `
        FROM invoice_xray_details x
        INNER JOIN orders o ON o.id = x.order_id
        INNER JOIN facilities f ON f.id = o.facility_id
      `,
      conditions,
      params,
      amountColumns: {
        invoiced: "COALESCE(x.payment, 0)",
        paid: "COALESCE(x.amount_paid, 0)",
        due: XRAY_AMOUNT_DUE_EXPR,
      },
    });
  }
}

module.exports = InvoiceReport;
