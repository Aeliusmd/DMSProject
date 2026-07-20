const { getPool } = require("../config/database");
const { likePrefix } = require("../utils/sqlSafety");

const SELECT_COLUMNS = `
  id, company_user_id, log_date, log_time, action, module, company_name,
  performed_by_type, performed_by_admin_id, performed_by_employee_id,
  performer_name, performer_initials, details, portal_order_id, created_at
`;

function buildFindAllWhere(filters = {}) {
  const conditions = ["company_user_id = :companyUserId"];
  const params = { companyUserId: filters.companyUserId };

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

  if (filters.employeeId) {
    conditions.push("performed_by_employee_id = :employeeId");
    params.employeeId = filters.employeeId;
  }

  if (filters.performedByType === "admin" || filters.performedByType === "employee") {
    conditions.push("performed_by_type = :performedByType");
    params.performedByType = filters.performedByType;
  }

  if (filters.search) {
    conditions.push("performer_name LIKE :searchPrefix");
    params.searchPrefix = likePrefix(filters.search);
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    params,
  };
}

class CompanyPortalActivityLog {
  static async create(data) {
    const pool = getPool();

    const [result] = await pool.execute(
      `INSERT INTO company_portal_activity_logs (
        company_user_id, log_date, log_time, action, module, company_name,
        performed_by_type, performed_by_admin_id, performed_by_employee_id,
        performer_name, performer_initials, details, portal_order_id, created_at
      ) VALUES (
        :companyUserId, :logDate, :logTime, :action, :module, :companyName,
        :performedByType, :performedByAdminId, :performedByEmployeeId,
        :performerName, :performerInitials, :details, :portalOrderId, NOW()
      )`,
      data
    );

    return result.insertId;
  }

  static async findAll(filters = {}) {
    const pool = getPool();
    const { whereClause, params } = buildFindAllWhere(filters);
    const limit =
      filters.limit && Number(filters.limit) > 0
        ? Math.min(Number(filters.limit), 500)
        : 500;

    const [rows] = await pool.execute(
      `SELECT ${SELECT_COLUMNS}
       FROM company_portal_activity_logs
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

    if (cursorId) {
      params.cursorId = cursorId;
    }

    const keysetWhereClause = cursorId
      ? `${whereClause} AND id < :cursorId`
      : whereClause;

    const [rows] = await pool.execute(
      `SELECT ${SELECT_COLUMNS}
       FROM company_portal_activity_logs
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
}

module.exports = CompanyPortalActivityLog;
