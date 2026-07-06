const { getPool } = require("../config/database");

const METRIC_TYPES = ["created", "updated", "completed", "cancelled", "deleted"];

function buildDateClause({ from, to }, params, prefix = "event") {
  const parts = [];

  if (from) {
    parts.push(`event_date >= :${prefix}From`);
    params[`${prefix}From`] = from;
  }

  if (to) {
    parts.push(`event_date <= :${prefix}To`);
    params[`${prefix}To`] = to;
  }

  return parts.length ? `AND ${parts.join(" AND ")}` : "";
}

class EmployeeMilestoneEvent {
  static async recordEvent({ employeeId, orderId, metricType, eventDate }) {
    const employee = Number(employeeId);
    const order = Number(orderId);

    if (!Number.isFinite(employee) || !Number.isFinite(order) || !order) {
      return false;
    }

    if (!METRIC_TYPES.includes(metricType)) {
      return false;
    }

    const pool = getPool();
    const resolvedDate =
      eventDate || new Date().toISOString().slice(0, 10);

    await pool.execute(
      `INSERT IGNORE INTO employee_order_milestone_events (
        employee_id, order_id, metric_type, event_date
      ) VALUES (
        :employeeId, :orderId, :metricType, :eventDate
      )`,
      {
        employeeId: employee,
        orderId: order,
        metricType,
        eventDate: resolvedDate,
      }
    );

    return true;
  }

  static normalizeStatsRows(rows = []) {
    const counts = Object.fromEntries(METRIC_TYPES.map((type) => [type, 0]));

    for (const row of rows) {
      const type = String(row.metric_type || "").toLowerCase();
      if (METRIC_TYPES.includes(type)) {
        counts[type] = Number(row.order_count) || 0;
      }
    }

    const total =
      counts.created +
      counts.updated +
      counts.completed +
      counts.cancelled +
      counts.deleted;

    return {
      created_orders: counts.created,
      updated_orders: counts.updated,
      completed_orders: counts.completed,
      cancelled_orders: counts.cancelled,
      deleted_orders: counts.deleted,
      total_orders: total,
    };
  }

  static async countStatsByEmployee(employeeId, { from, to } = {}) {
    const pool = getPool();
    const params = { employeeId: Number(employeeId) };
    const dateFilter = buildDateClause({ from, to }, params);

    const [rows] = await pool.execute(
      `SELECT metric_type, COUNT(DISTINCT order_id) AS order_count
       FROM employee_order_milestone_events
       WHERE employee_id = :employeeId
         ${dateFilter}
       GROUP BY metric_type`,
      params
    );

    return this.normalizeStatsRows(rows);
  }
}

module.exports = EmployeeMilestoneEvent;
