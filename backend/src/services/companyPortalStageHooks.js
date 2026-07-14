/**
 * Company-portal-only stage progression hooks.
 * Does not alter internal order workflow; only updates company_portal_orders.status
 * when the linked internal order has creation_source = company_portal.
 */

const CompanyPortalOrder = require("../models/CompanyPortalOrder");
const Order = require("../models/Order");
const Invoice = require("../models/Invoice");
const InvoiceXray = require("../models/InvoiceXray");
const {
  areAllOrderInvoicesPaid,
  hasStandardInvoiceFields,
  hasXrayInvoiceFields,
} = require("../utils/orderInvoicePayment");

const STAGE_RANK = {
  Draft: 0,
  "Awaiting Payment": 1,
  "In Process": 2,
  Invoice: 3,
  Paid: 4,
  Released: 5,
  Cancelled: -1,
};

function rankOf(status) {
  return STAGE_RANK[status] ?? 0;
}

async function findCompanyPortalContext(internalOrderId) {
  const orderId = Number(internalOrderId);
  if (!Number.isFinite(orderId) || orderId <= 0) return null;

  const [order, portal] = await Promise.all([
    Order.findById(orderId),
    CompanyPortalOrder.findByInternalOrderId(orderId),
  ]);

  if (!order || order.creation_source !== "company_portal" || !portal) {
    return null;
  }

  return { order, portal };
}

async function advancePortalStatus(portal, nextStatus) {
  if (!portal || !nextStatus) return portal;
  if (portal.status === "Cancelled" || portal.status === "Released") {
    return portal;
  }

  if (rankOf(nextStatus) <= rankOf(portal.status)) {
    return portal;
  }

  return CompanyPortalOrder.updateStatus(portal.id, nextStatus);
}

async function maybeAdvanceCompanyPortalAfterInvoiceSent(internalOrderId) {
  const ctx = await findCompanyPortalContext(internalOrderId);
  if (!ctx) return null;
  return advancePortalStatus(ctx.portal, "Invoice");
}

async function maybeAdvanceCompanyPortalAfterInvoicesPaid(internalOrderId) {
  const ctx = await findCompanyPortalContext(internalOrderId);
  if (!ctx) return null;

  const allPaid = await areAllOrderInvoicesPaid(internalOrderId);
  if (!allPaid) return ctx.portal;

  return advancePortalStatus(ctx.portal, "Paid");
}

async function buildCompanyPortalInvoicePaymentLinks(internalOrderId) {
  const orderId = Number(internalOrderId);
  if (!Number.isFinite(orderId) || orderId <= 0) return [];

  const [invoice, xray] = await Promise.all([
    Invoice.findByOrderId(orderId),
    InvoiceXray.findByOrderId(orderId),
  ]);

  const { getPaymentUrlForOrder } = require("./stripePaymentService");
  const hasUnpaid =
    (invoice &&
      hasStandardInvoiceFields(invoice) &&
      invoice.status !== "Paid" &&
      Number(invoice.amount_due) > 0) ||
    (xray &&
      hasXrayInvoiceFields(xray) &&
      (() => {
        const total = Number(xray.payment) || 0;
        const paid = Number(xray.amount_paid) || 0;
        const writeoff = Number(xray.writeoff_amount) || 0;
        return Math.max(0, total - paid - writeoff) > 0;
      })());

  if (!hasUnpaid) return [];

  const paymentUrl = await getPaymentUrlForOrder(orderId);
  if (!paymentUrl) return [];

  const links = [];

  if (invoice && hasStandardInvoiceFields(invoice)) {
    const due = Math.max(0, Number(invoice.amount_due) || 0);
    if (invoice.status !== "Paid" && due > 0) {
      links.push({
        type: "regular",
        label: "Regular Invoice",
        invoiceNumber: invoice.invoice_number || "",
        due,
        dueDisplay: `$${due.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        url: paymentUrl,
      });
    }
  }

  if (xray && hasXrayInvoiceFields(xray)) {
    const total = Number(xray.payment) || 0;
    const paid = Number(xray.amount_paid) || 0;
    const writeoff = Number(xray.writeoff_amount) || 0;
    const due = Math.max(0, total - paid - writeoff);
    if (due > 0) {
      links.push({
        type: "xray",
        label: "X-Ray Invoice",
        invoiceNumber: xray.invoice_number || "",
        due,
        dueDisplay: `$${due.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        url: paymentUrl,
      });
    }
  }

  return links;
}

async function enrichCompanyPortalOrderStageMeta(internalOrderIds = []) {
  const ids = [...new Set(internalOrderIds.map(Number).filter((id) => id > 0))];
  if (!ids.length) return new Map();

  const map = new Map();

  await Promise.all(
    ids.map(async (orderId) => {
      const [invoice, xray, paid] = await Promise.all([
        Invoice.findByOrderId(orderId),
        InvoiceXray.findByOrderId(orderId),
        areAllOrderInvoicesPaid(orderId),
      ]);

      const invoiceSent = Boolean(
        (invoice && invoice.sent_date) || (xray && xray.sent_date)
      );

      map.set(orderId, {
        invoiceSent,
        allInvoicesPaid: paid,
      });
    })
  );

  return map;
}

function resolveEffectiveCompanyPortalStatus(portalStatus, stageMeta = {}) {
  const status = String(portalStatus || "In Process").trim() || "In Process";

  if (
    status === "Invoice" &&
    stageMeta.invoiceSent &&
    stageMeta.allInvoicesPaid
  ) {
    return "Paid";
  }

  return status;
}

function canCompanyPortalScanRecords(portalStatus, stageMeta = {}, hasAllRecordsUploaded = false) {
  if (hasAllRecordsUploaded) return false;

  const effectiveStatus = resolveEffectiveCompanyPortalStatus(
    portalStatus,
    stageMeta
  );

  if (effectiveStatus === "Paid" || effectiveStatus === "Released") {
    return true;
  }

  return (
    Boolean(stageMeta.invoiceSent) && Boolean(stageMeta.allInvoicesPaid)
  );
}

function canCompanyPortalEmailRecords(portalStatus, stageMeta = {}, hasRecords = false) {
  const effectiveStatus = resolveEffectiveCompanyPortalStatus(
    portalStatus,
    stageMeta
  );

  return effectiveStatus === "Paid" && Boolean(hasRecords);
}

module.exports = {
  maybeAdvanceCompanyPortalAfterInvoiceSent,
  maybeAdvanceCompanyPortalAfterInvoicesPaid,
  buildCompanyPortalInvoicePaymentLinks,
  enrichCompanyPortalOrderStageMeta,
  findCompanyPortalContext,
  advancePortalStatus,
  resolveEffectiveCompanyPortalStatus,
  canCompanyPortalScanRecords,
  canCompanyPortalEmailRecords,
};
