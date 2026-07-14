/**
 * Staff DMS views / stats for personal portal requests.
 */

const PersonalRequestOrder = require("../models/PersonalRequestOrder");

const PORTAL_STATUS_LABELS = {
  pending_payment: "Pending Payment",
  in_process: "In Process",
  invoice: "Invoice",
  paid: "Paid",
  released: "Released",
};

async function getStaffPersonalOrderStats() {
  // Link any paid portal requests that were fulfilled before thin DMS orders existed
  try {
    const personalPortalService = require("./personalPortalService");
    if (typeof personalPortalService.backfillMissingDmsOrderLinks === "function") {
      await personalPortalService.backfillMissingDmsOrderLinks();
    }
  } catch (_error) {
    // non-blocking
  }

  const row = await PersonalRequestOrder.countPaidStats();
  return {
    totalOrders: Number(row.total) || 0,
    inProcess: Number(row.in_process) || 0,
    invoice: Number(row.invoice) || 0,
    paid: Number(row.paid) || 0,
    released: Number(row.released) || 0,
  };
}

module.exports = {
  getStaffPersonalOrderStats,
  PORTAL_STATUS_LABELS,
};
