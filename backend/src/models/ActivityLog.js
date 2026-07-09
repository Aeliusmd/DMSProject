const { getPool } = require("../config/database");
const { likeContains, likePrefix } = require("../utils/sqlSafety");

const ACTIVITY_LOG_SELECT = `id, log_date, log_time, action, module, company_name, facility_id,
              performed_by, performer_name, performer_initials, details, created_at`;

function buildFindByEmployeeWhere(employeeId, filters = {}) {
  const params = {
    employeeId,
    targetTag: `%target_employee_id:${Number(employeeId)}%`,
  };
  const conditions = ["(performed_by = :employeeId OR details LIKE :targetTag)"];

  if (filters.search) {
    const trimmedSearch = `${filters.search}`.trim();
    if (trimmedSearch) {
      conditions.push(`(
        performer_name LIKE :search
        OR action LIKE :search
        OR details LIKE :search
        OR module LIKE :search
      )`);
      params.search = likeContains(trimmedSearch);
    }
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    params,
  };
}

function buildFindAllWhere(filters = {}) {
  const conditions = [];
  const params = {};

  if (filters.performedBy) {
    conditions.push("performed_by = :performedBy");
    params.performedBy = filters.performedBy;
  }

  if (filters.module) {
    conditions.push("module = :module");
    params.module = filters.module;
  }

  if (filters.fromDate) {
    conditions.push("log_date >= :fromDate");
    params.fromDate = filters.fromDate;
  }

  if (filters.toDate) {
    conditions.push("log_date <= :toDate");
    params.toDate = filters.toDate;
  }

  if (filters.search) {
    conditions.push("performer_name LIKE :searchPrefix");
    params.searchPrefix = likePrefix(filters.search);
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
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
    const { whereClause, params } = buildFindByEmployeeWhere(employeeId);

    const [rows] = await pool.execute(
      `SELECT ${ACTIVITY_LOG_SELECT}
       FROM activity_logs
       ${whereClause}
       ORDER BY id DESC
       LIMIT ${Number(limit)}`,
      params
    );

    return rows;
  }

  static async findByEmployeeIdKeyset(employeeId, filters = {}) {
    const pool = getPool();
    const { whereClause, params } = buildFindByEmployeeWhere(employeeId, filters);
    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 100);
    const queryLimit = pageSize + 1;
    const cursorId =
      Number(filters.cursorId) > 0 ? Number(filters.cursorId) : null;
    const cursorCondition = cursorId ? "id < :cursorId" : "";

    if (cursorId) {
      params.cursorId = cursorId;
    }

    const keysetWhereClause = cursorCondition
      ? `${whereClause} AND ${cursorCondition}`
      : whereClause;

    const [rows] = await pool.execute(
      `SELECT ${ACTIVITY_LOG_SELECT}
       FROM activity_logs
       ${keysetWhereClause}
       ORDER BY id DESC
       LIMIT ${queryLimit}`,
      params
    );

    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

    if (cursorId && !pageRows.length) {
      return {
        rows: pageRows,
        pageSize,
        hasMore: false,
        nextCursor: null,
      };
    }

    const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.id || null : null;

    return {
      rows: pageRows,
      pageSize,
      hasMore,
      nextCursor,
    };
  }

  static async findAll(filters = {}) {
    const pool = getPool();
    const { whereClause, params } = buildFindAllWhere(filters);
    const limit =
      filters.limit && Number(filters.limit) > 0
        ? Math.min(Number(filters.limit), 500)
        : 500;

    const [rows] = await pool.execute(
      `SELECT ${ACTIVITY_LOG_SELECT}
       FROM activity_logs
       ${whereClause}
       ORDER BY id DESC
       LIMIT ${limit}`,
      params
    );

    return rows;
  }

  static async findAllKeyset(filters = {}) {
    const pool = getPool();
    const { whereClause, params } = buildFindAllWhere(filters);
    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 100);
    const queryLimit = pageSize + 1;
    const cursorId =
      Number(filters.cursorId) > 0 ? Number(filters.cursorId) : null;
    const cursorCondition = cursorId ? "id < :cursorId" : "";

    if (cursorId) {
      params.cursorId = cursorId;
    }

    const keysetWhereClause = cursorCondition
      ? whereClause
        ? `${whereClause} AND ${cursorCondition}`
        : `WHERE ${cursorCondition}`
      : whereClause;

    const [rows] = await pool.execute(
      `SELECT ${ACTIVITY_LOG_SELECT}
       FROM activity_logs
       ${keysetWhereClause}
       ORDER BY id DESC
       LIMIT ${queryLimit}`,
      params
    );

    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

    if (cursorId && !pageRows.length) {
      return {
        rows: pageRows,
        pageSize,
        hasMore: false,
        nextCursor: null,
      };
    }

    const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.id || null : null;

    return {
      rows: pageRows,
      pageSize,
      hasMore,
      nextCursor,
    };
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
      params.orderNumberTag = likeContains(orderNumber);
      params.orderLabelTag = likeContains(`order ${orderNumber}`);
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
}

module.exports = ActivityLog;
