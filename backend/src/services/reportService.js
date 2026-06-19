/**
 * Report aggregations for DMS reporting pages.
 */

const { getPool } = require("../config/database");
const Order = require("../models/Order");
const { calculateOrderRushLevel } = require("../utils/rushUtils");

const PRODUCED_STATUSES = new Set(["Ready", "Ready to Pickup", "Completed"]);

const RECORD_TITLES = {
  medical: "Medical Records",
  billing: "Billing Records",
  employment: "Employment Records",
  xrays: "X-Ray Films",
};

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value) {
  return `$${toNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildFullName(first, middle, last) {
  return [first, middle, last].filter(Boolean).join(" ").trim();
}

function normalizeDate(value) {
  if (!value) return "";
  const str = String(value).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function toShortDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${month}/${day}/${year}`;
}

function buildRecordsRequested(row) {
  const type = RECORD_TITLES[row.order_type] || "Records";
  const parts = [];

  if (row.specific_record) parts.push(row.specific_record);
  if (row.specific_doctor) parts.push(row.specific_doctor);

  if (parts.length) {
    return parts.join(" ");
  }

  return type;
}

function buildAddress(row) {
  const address = [
    row.serve_address,
    [row.serve_city, row.serve_state].filter(Boolean).join(", "),
    row.serve_zip,
  ]
    .filter(Boolean)
    .join(" ");

  return address || row.full_address || "";
}

function mapReportOrderRow(row) {
  const totalAmount = toNumber(row.total_amount);
  const invoiced = Boolean(row.invoice_id && totalAmount > 0);
  const rush = calculateOrderRushLevel(row.created_at);

  return {
    id: row.id,
    dbId: row.id,
    orderNo: row.order_number || "",
    subNo: row.order_ref || "",
    status: row.status || "",
    invoiced,
    invoicePaid: row.invoice_status === "Paid",
    invoiceStatus: row.invoice_status || null,
    invoiceAmount: invoiced ? formatMoney(totalAmount) : "$0.00",
    subpoenaDate: normalizeDate(row.subpoena_date),
    dateServed: normalizeDate(row.date_served),
    applicant: buildFullName(
      row.applicant_first_name,
      row.applicant_middle_name,
      row.applicant_last_name
    ),
    caseNumber: row.case_number || "",
    dob: toShortDate(row.dob),
    ssn: row.ssn_last_four ? `XXX-XX-${row.ssn_last_four}` : "",
    provider: row.serve_company_name || row.provider_name || "",
    recordsRequested: buildRecordsRequested(row),
    doctor: row.specific_doctor || "",
    address: buildAddress(row),
    createdAt: row.created_at || null,
    rushLevel: rush.label,
    rushLabel: rush.label,
    subpoenaUrl: row.subpoena_storage_path
      ? `/uploads/${row.subpoena_storage_path}`
      : "",
  };
}

function dedupeByOrderNumber(orders = []) {
  const seen = new Set();

  return orders.filter((order) => {
    const key = order.orderNo || String(order.id);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function getOrdersReport({
  orderNo = "",
  caseNumber = "",
  doctor = "",
  dateFrom = null,
  dateTo = null,
  rushLevel = "",
  unpaidOnly = false,
  showDuplicates = true,
} = {}) {
  const rows = await Order.findForReport({
    orderNo: orderNo?.trim() || null,
    caseNumber: caseNumber?.trim() || null,
    doctor: doctor?.trim() || null,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    unpaidOnly: Boolean(unpaidOnly),
  });

  let orders = rows.map(mapReportOrderRow);

  if (rushLevel) {
    orders = orders.filter((order) => order.rushLevel === rushLevel);
  }

  if (!showDuplicates) {
    orders = dedupeByOrderNumber(orders);
  }

  return {
    orders,
    count: orders.length,
  };
}

function deriveCaseActivities(row) {
  const activities = new Set();
  const totalAmount = toNumber(row.total_amount);
  const amountPaid = toNumber(row.amount_paid);
  const amountDue = toNumber(row.amount_due);
  const invoiceStatus = String(row.invoice_status || "");

  if (row.invoice_id && totalAmount > 0) {
    activities.add("Invoiced");
  }

  if (
    row.invoice_id &&
    (invoiceStatus === "Paid" || amountPaid >= totalAmount)
  ) {
    activities.add("Paid");
  }

  if (row.invoice_id && amountDue > 0 && invoiceStatus !== "Paid") {
    activities.add("Unpaid");
  }

  if (PRODUCED_STATUSES.has(row.order_status)) {
    activities.add("Produced");
  }

  return Array.from(activities);
}

function getPrimaryActivity(activities = []) {
  if (activities.includes("Paid")) return "Paid";
  if (activities.includes("Unpaid")) return "Unpaid";
  if (activities.includes("Invoiced")) return "Invoiced";
  if (activities.includes("Produced")) return "Produced";
  return "Activity";
}

function getCaseAmount(row, activity) {
  if (activity === "Paid") {
    return toNumber(row.amount_paid);
  }

  if (activity === "Unpaid") {
    return toNumber(row.amount_due);
  }

  return toNumber(row.total_amount);
}

function companyMatchesActivity(activities, filter) {
  if (!filter || filter === "All") return true;
  return activities.includes(filter);
}

function companyMatchesSearch(company, search) {
  if (!search) return true;

  const term = search.toLowerCase();

  return (
    company.name.toLowerCase().includes(term) ||
    String(company.cases).includes(term) ||
    String(company.invoiced).includes(term) ||
    String(company.paid).includes(term)
  );
}

async function getActivityReport({
  dateFrom = null,
  dateTo = null,
  facilityId = null,
  activity = "All",
  search = "",
} = {}) {
  const pool = getPool();
  const conditions = ["f.is_active = 1"];
  const params = {};

  if (dateFrom) {
    conditions.push(
      "DATE(COALESCE(i.invoice_date, o.created_at)) >= :dateFrom"
    );
    params.dateFrom = dateFrom;
  }

  if (dateTo) {
    conditions.push(
      "DATE(COALESCE(i.invoice_date, o.created_at)) <= :dateTo"
    );
    params.dateTo = dateTo;
  }

  if (facilityId) {
    conditions.push("f.id = :facilityId");
    params.facilityId = Number(facilityId);
  }

  const [rows] = await pool.execute(
    `SELECT
      f.id AS facility_id,
      f.facility_name,
      o.id AS order_id,
      o.order_number,
      o.applicant_first_name,
      o.applicant_middle_name,
      o.applicant_last_name,
      o.status AS order_status,
      o.created_at AS order_created_at,
      i.id AS invoice_id,
      i.total_amount,
      i.amount_paid,
      i.amount_due,
      i.status AS invoice_status,
      i.invoice_date
    FROM orders o
    INNER JOIN facilities f ON f.id = o.facility_id
    LEFT JOIN invoices i ON i.id = (
      SELECT i2.id
      FROM invoices i2
      WHERE i2.order_id = o.id
      ORDER BY i2.id DESC
      LIMIT 1
    )
    WHERE ${conditions.join(" AND ")}
    ORDER BY f.facility_name ASC, o.id DESC`,
    params
  );

  const companiesMap = new Map();

  rows.forEach((row) => {
    const facilityKey = row.facility_id;

    if (!companiesMap.has(facilityKey)) {
      companiesMap.set(facilityKey, {
        id: row.facility_id,
        name: row.facility_name || "Unknown Facility",
        cases: [],
        invoiced: 0,
        paid: 0,
        activities: new Set(),
      });
    }

    const company = companiesMap.get(facilityKey);
    const caseActivities = deriveCaseActivities(row);
    const primaryActivity = getPrimaryActivity(caseActivities);
    const amount = getCaseAmount(row, primaryActivity);

    caseActivities.forEach((item) => company.activities.add(item));

    company.cases.push({
      orderId: row.order_id,
      caseNo: row.order_number || "",
      applicant:
        buildFullName(
          row.applicant_first_name,
          row.applicant_middle_name,
          row.applicant_last_name
        ) || "—",
      activity: primaryActivity,
      activities: caseActivities,
      amount,
      amountDisplay: formatMoney(amount),
      invoiceDate: normalizeDate(row.invoice_date || row.order_created_at),
    });

    company.invoiced += toNumber(row.total_amount);
    company.paid += toNumber(row.amount_paid);
  });

  let companies = Array.from(companiesMap.values()).map((company) => {
    const activities = Array.from(company.activities);

    return {
      id: company.id,
      name: company.name,
      cases: company.cases.length,
      invoiced: company.invoiced,
      invoicedDisplay: formatMoney(company.invoiced),
      paid: company.paid,
      paidDisplay: formatMoney(company.paid),
      activities,
      caseRows: company.cases,
    };
  });

  companies = companies.filter((company) => {
    return (
      companyMatchesActivity(company.activities, activity) &&
      companyMatchesSearch(company, search)
    );
  });

  const totalCases = companies.reduce((sum, company) => sum + company.cases, 0);

  return {
    companies,
    summary: {
      facilityCount: companies.length,
      totalCases,
    },
  };
}

module.exports = {
  getOrdersReport,
  getActivityReport,
};
