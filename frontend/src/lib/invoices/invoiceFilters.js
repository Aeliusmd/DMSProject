function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "$0.00";

  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseMoney(value) {
  if (typeof value === "number") return value;
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

export function matchesOrderIdFilter(item, orderIdQuery) {
  if (!orderIdQuery?.trim()) return true;

  const query = orderIdQuery.trim().toLowerCase();

  return (
    String(item.caseNo || "")
      .toLowerCase()
      .includes(query) ||
    String(item.orderId || "")
      .toLowerCase()
      .includes(query)
  );
}

function recalculateGroupTotals(group) {
  let invoiced = 0;
  let paid = 0;
  let due = 0;

  group.rows.forEach((row) => {
    invoiced += parseMoney(row.invoiced);
    paid += parseMoney(row.paid);
    due += parseMoney(row.due);
  });

  return {
    ...group,
    total: {
      invoiced: formatMoney(invoiced),
      paid: formatMoney(paid),
      due: formatMoney(due),
    },
  };
}

export function filterInvoiceGroups(groups = [], orderIdQuery = "") {
  if (!orderIdQuery?.trim()) return groups;

  return groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) => matchesOrderIdFilter(row, orderIdQuery)),
    }))
    .filter((group) => group.rows.length > 0)
    .map(recalculateGroupTotals);
}

export function filterResendInvoices(invoices = [], orderIdQuery = "") {
  if (!orderIdQuery?.trim()) return invoices;

  return invoices.filter((invoice) => matchesOrderIdFilter(invoice, orderIdQuery));
}

export function buildSummaryFromRows(rows = []) {
  const companies = new Set();
  let invoiced = 0;
  let paid = 0;
  let due = 0;

  rows.forEach((row) => {
    if (row.company) companies.add(row.company);
    invoiced += parseMoney(row.invoiced);
    paid += parseMoney(row.paid);
    due += parseMoney(row.due);
  });

  return {
    companies: companies.size,
    cases: rows.length,
    invoiced: formatMoney(invoiced),
    paid: formatMoney(paid),
    due: formatMoney(due),
  };
}

export function buildSummaryFromOutstandingGroups(groups = []) {
  const companies = new Set();
  const rows = [];

  groups.forEach((group) => {
    companies.add(group.company);
    rows.push(...group.rows);
  });

  let invoiced = 0;
  let paid = 0;
  let due = 0;

  rows.forEach((row) => {
    invoiced += parseMoney(row.invoiced);
    paid += parseMoney(row.paid);
    due += parseMoney(row.due);
  });

  return {
    companies: companies.size,
    cases: rows.length,
    invoiced: formatMoney(invoiced),
    paid: formatMoney(paid),
    due: formatMoney(due),
  };
}

export function countOutstandingRows(groups = []) {
  return groups.reduce((sum, group) => sum + group.rows.length, 0);
}
