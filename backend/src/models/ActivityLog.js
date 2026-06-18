const { getPool } = require("../config/database");

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

  static async findByOrderId(orderId, { limit = 200 } = {}) {
    const pool = getPool();
    const orderTag = `%order_id:${Number(orderId)}%`;

    const [rows] = await pool.execute(
      `SELECT id, log_date, log_time, action, module, company_name, facility_id,
              performed_by, performer_name, performer_initials, details, created_at
       FROM activity_logs
       WHERE module = 'Orders'
         AND details LIKE :orderTag
       ORDER BY created_at DESC, id DESC
       LIMIT ${Number(limit)}`,
      { orderTag }
    );

    return rows;
  }
}

module.exports = ActivityLog;
