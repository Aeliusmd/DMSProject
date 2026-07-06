const { getPool } = require("../config/database");

const ORDER_ID_FROM_DETAILS =
  "CAST(NULLIF(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(al.details, 'order_id:', -1), ' |', 1)), '') AS UNSIGNED)";

const COMPLETED_ORDER_ACTIONS = [
  "Records Ready Email Sent",
  "Order Pickup Recorded",
];

const CANCELLED_ORDER_ACTIONS = ["Order Cancelled"];

function buildMilestoneDateClause(column, { from, to }, params, prefix) {
  const parts = [];

  if (from) {
    parts.push(`${column} >= :${prefix}From`);
    params[`${prefix}From`] = from;
  }

  if (to) {
    parts.push(`${column} <= :${prefix}To`);
    params[`${prefix}To`] = to;
  }

  return parts.length ? `AND ${parts.join(" AND ")}` : "";
}

class ActivityLog {
  static async create(data) {
    const pool = getPool();

    const [result] = await pool.execute(
      `INSERT INTO activity_logs (
        log_date, log_time, action, module, company_name, facility_id,
        performed_by, performer_name, performer_initials, details, created_at
      ) VALUES (
        :logDate, :logTime, :action, :module, :companyName, :facilityId,
        :performedBy, :performerName, :performerInitials, :details, NOW()
      )`,
      data
    );

    return result.insertId;
  }

  static async findByPerformerId(employeeId, { limit = 200 } = {}) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, log_date, log_time, action, module, company_name, facility_id,
              performed_by, performer_name, performer_initials, details, created_at
       FROM activity_logs
       WHERE performed_by = :employeeId
       ORDER BY created_at DESC, id DESC
       LIMIT ${Number(limit)}`,
      { employeeId }
    );

    return rows;
  }

  static async findByEmployeeId(employeeId, { limit = 200 } = {}) {
    const pool = getPool();
    const targetTag = `%target_employee_id:${Number(employeeId)}%`;

    const [rows] = await pool.execute(
      `SELECT id, log_date, log_time, action, module, company_name, facility_id,
              performed_by, performer_name, performer_initials, details, created_at
       FROM activity_logs
       WHERE performed_by = :employeeId
          OR details LIKE :targetTag
       ORDER BY created_at DESC, id DESC
       LIMIT ${Number(limit)}`,
      { employeeId, targetTag }
    );

    return rows;
  }

  static async findAll({ limit = 500 } = {}) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, log_date, log_time, action, module, company_name, facility_id,
              performed_by, performer_name, performer_initials, details, created_at
       FROM activity_logs
       ORDER BY created_at DESC, id DESC
       LIMIT ${Number(limit)}`
    );

    return rows;
  }

  static async findById(id) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT *
       FROM activity_logs
       WHERE id = :id
       LIMIT 1`,
      { id }
    );

    return rows[0] || null;
  }

  static async findByOrderId(orderId, { limit = 200, orderNumber = null } = {}) {
    const pool = getPool();
    const normalizedOrderId = Number(orderId);
    const orderTag = `%order_id:${normalizedOrderId}%`;
    const conditions = ["details LIKE :orderTag"];
    const params = { orderTag };

    if (orderNumber) {
      conditions.push(
        "(module = 'Orders' AND (details LIKE :orderNumberTag OR details LIKE :orderLabelTag))"
      );
      params.orderNumberTag = `%${orderNumber}%`;
      params.orderLabelTag = `%order ${orderNumber}%`;
    }

    const [rows] = await pool.execute(
      `SELECT id, log_date, log_time, action, module, company_name, facility_id,
              performed_by, performer_name, performer_initials, details, created_at
       FROM activity_logs
       WHERE ${conditions.join(" OR ")}
       ORDER BY created_at DESC, id DESC
       LIMIT ${Number(limit)}`,
      params
    );

    return rows;
  }

  static normalizeMilestoneStatsRow(row = {}) {
    const created =
      Number(row.created_orders ?? row.active_orders) || 0;
    const updated = Number(row.updated_orders) || 0;
    const completed = Number(row.completed_orders) || 0;
    const cancelled = Number(row.cancelled_orders) || 0;
    const deleted = Number(row.deleted_orders) || 0;

    return {
      created_orders: created,
      updated_orders: updated,
      completed_orders: completed,
      cancelled_orders: cancelled,
      deleted_orders: deleted,
      total_orders:
        Number(row.total_orders) ||
        created + updated + completed + cancelled + deleted,
    };
  }

  static async countOrderMilestoneStatsByPerformer(employeeId, { from, to } = {}) {
    try {
      const row = await this._countOrderMilestoneStatsProcedure(employeeId, {
        from,
        to,
      });

      if (row) {
        return this.normalizeMilestoneStatsRow(row);
      }
    } catch {
      // Procedure not installed yet — fall back to inline query.
    }

    return this._countOrderMilestoneStatsQuery(employeeId, { from, to });
  }

  static async _countOrderMilestoneStatsProcedure(employeeId, { from, to } = {}) {
    const pool = getPool();

    const [resultSets] = await pool.execute(
      "CALL sp_employee_order_milestone_stats(:employeeId, :fromDate, :toDate)",
      {
        employeeId,
        fromDate: from || null,
        toDate: to || null,
      }
    );

    const rows = Array.isArray(resultSets?.[0]) ? resultSets[0] : resultSets;
    return rows?.[0] || null;
  }

  static async _countOrderMilestoneStatsQuery(employeeId, { from, to } = {}) {
    const pool = getPool();
    const params = { employeeId };
    const createdDateFilter = buildMilestoneDateClause(
      "DATE(o.created_at)",
      { from, to },
      params,
      "created"
    );
    const logDateFilter = buildMilestoneDateClause(
      "al.log_date",
      { from, to },
      params,
      "log"
    );
    const cancelledDateFilter = buildMilestoneDateClause(
      "DATE(o.cancelled_at)",
      { from, to },
      params,
      "cancel"
    );
    const deletedDateFilter = buildMilestoneDateClause(
      "DATE(o.deleted_at)",
      { from, to },
      params,
      "delete"
    );
    const completedActions = COMPLETED_ORDER_ACTIONS.map((action) => `'${action}'`).join(
      ", "
    );
    const cancelledActions = CANCELLED_ORDER_ACTIONS.map((action) => `'${action}'`).join(
      ", "
    );

    const [rows] = await pool.execute(
      `SELECT
        (
          SELECT COUNT(DISTINCT order_id)
          FROM (
            SELECT ${ORDER_ID_FROM_DETAILS} AS order_id
            FROM activity_logs al
            WHERE al.performed_by = :employeeId
              AND al.module = 'Orders'
              AND al.action = 'Order Created'
              AND al.details LIKE '%order_id:%'
              ${logDateFilter}
            UNION
            SELECT o.id AS order_id
            FROM orders o
            WHERE o.created_by = :employeeId
              ${createdDateFilter}
          ) created_src
          WHERE order_id IS NOT NULL AND order_id > 0
        ) AS created_orders,
        (
          SELECT COUNT(DISTINCT order_id)
          FROM (
            SELECT ${ORDER_ID_FROM_DETAILS} AS order_id
            FROM activity_logs al
            WHERE al.performed_by = :employeeId
              AND al.module = 'Orders'
              AND al.action = 'Order Updated'
              AND al.details LIKE '%order_id:%'
              ${logDateFilter}
          ) updated_src
          WHERE order_id IS NOT NULL AND order_id > 0
        ) AS updated_orders,
        (
          SELECT COUNT(DISTINCT order_id)
          FROM (
            SELECT ${ORDER_ID_FROM_DETAILS} AS order_id
            FROM activity_logs al
            WHERE al.performed_by = :employeeId
              AND al.module = 'Orders'
              AND al.action IN (${completedActions})
              AND al.details LIKE '%order_id:%'
              ${logDateFilter}
            UNION
            SELECT ${ORDER_ID_FROM_DETAILS} AS order_id
            FROM activity_logs al
            WHERE al.performed_by = :employeeId
              AND al.module = 'Billing'
              AND al.action = 'Invoice Written Off'
              AND al.details LIKE '%Status: Completed%'
              AND al.details LIKE '%order_id:%'
              ${logDateFilter}
          ) completed_src
          WHERE order_id IS NOT NULL AND order_id > 0
        ) AS completed_orders,
        (
          SELECT COUNT(DISTINCT order_id)
          FROM (
            SELECT ${ORDER_ID_FROM_DETAILS} AS order_id
            FROM activity_logs al
            WHERE al.performed_by = :employeeId
              AND al.module = 'Orders'
              AND al.action IN (${cancelledActions})
              AND al.details LIKE '%order_id:%'
              ${logDateFilter}
            UNION
            SELECT o.id AS order_id
            FROM orders o
            WHERE o.cancelled_by = :employeeId
              ${cancelledDateFilter}
          ) cancelled_src
          WHERE order_id IS NOT NULL AND order_id > 0
        ) AS cancelled_orders,
        (
          SELECT COUNT(DISTINCT order_id)
          FROM (
            SELECT ${ORDER_ID_FROM_DETAILS} AS order_id
            FROM activity_logs al
            WHERE al.performed_by = :employeeId
              AND al.module = 'Orders'
              AND al.action = 'Order Deleted'
              AND al.details LIKE '%order_id:%'
              ${logDateFilter}
            UNION
            SELECT o.id AS order_id
            FROM orders o
            WHERE o.deleted_by = :employeeId
              ${deletedDateFilter}
          ) deleted_src
          WHERE order_id IS NOT NULL AND order_id > 0
        ) AS deleted_orders`,
      params
    );

    return this.normalizeMilestoneStatsRow(rows[0] || {});
  }
}

module.exports = ActivityLog;
