const EmployeeMilestoneEvent = require("../models/EmployeeMilestoneEvent");
const logger = require("../utils/logger");

function extractOrderIdFromDetails(details) {
  const match = String(details || "").match(/order_id:(\d+)/i);
  return match ? Number(match[1]) : null;
}

function resolveMetricType(action, module, details) {
  const normalizedAction = String(action || "").trim();
  const normalizedModule = String(module || "").trim();
  const text = String(details || "");

  if (normalizedModule === "Orders") {
    if (normalizedAction === "Order Created") return "created";
    if (normalizedAction === "Order Updated") return "updated";
    if (normalizedAction === "Order Cancelled") return "cancelled";
    if (normalizedAction === "Order Deleted") return "deleted";
    if (
      normalizedAction === "Records Ready Email Sent" ||
      normalizedAction === "Order Pickup Recorded"
    ) {
      return "completed";
    }
  }

  if (
    normalizedModule === "Billing" &&
    normalizedAction === "Invoice Written Off" &&
    text.includes("Status: Completed")
  ) {
    return "completed";
  }

  return null;
}

async function recordFromActivityLog({
  employeeId,
  action,
  module,
  details,
  eventDate,
}) {
  const orderId = extractOrderIdFromDetails(details);
  const metricType = resolveMetricType(action, module, details);

  if (!orderId || !metricType) {
    return false;
  }

  return EmployeeMilestoneEvent.recordEvent({
    employeeId,
    orderId,
    metricType,
    eventDate,
  });
}

async function recordFromOrderAction({
  employeeId,
  orderId,
  metricType,
  eventDate,
}) {
  return EmployeeMilestoneEvent.recordEvent({
    employeeId,
    orderId,
    metricType,
    eventDate,
  });
}

async function recordFromActivityLogSafe(payload) {
  try {
    return await recordFromActivityLog(payload);
  } catch (error) {
    logger.warn("Failed to record employee milestone rollup", {
      error: error.message,
    });
    return false;
  }
}

async function recordFromOrderActionSafe(payload) {
  try {
    return await recordFromOrderAction(payload);
  } catch (error) {
    logger.warn("Failed to record employee milestone rollup from order", {
      error: error.message,
    });
    return false;
  }
}

module.exports = {
  extractOrderIdFromDetails,
  resolveMetricType,
  recordFromActivityLog,
  recordFromOrderAction,
  recordFromActivityLogSafe,
  recordFromOrderActionSafe,
};
