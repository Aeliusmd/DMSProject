const { getPool } = require("../config/database");

class Notification {
  static async create(data) {
    const pool = getPool();

    const [result] = await pool.execute(
      `INSERT INTO notifications (
        employee_id, notification_type, title, description,
        reference_type, reference_id, is_read, read_at, created_at
      ) VALUES (
        :employeeId, :notificationType, :title, :description,
        :referenceType, :referenceId, 0, NULL, NOW()
      )`,
      {
        employeeId: data.employeeId,
        notificationType: data.notificationType,
        title: data.title,
        description: data.description || "",
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
      }
    );

    return result.insertId;
  }

  static async findByEmployeeId(employeeId, { limit = 100, type = null } = {}) {
    const pool = getPool();
    const params = { employeeId };
    let typeClause = "";

    if (type) {
      typeClause = "AND notification_type = :notificationType";
      params.notificationType = String(type).toLowerCase();
    }

    const [rows] = await pool.execute(
      `SELECT id, employee_id, notification_type, title, description,
              reference_type, reference_id, is_read, read_at, created_at
       FROM notifications
       WHERE employee_id = :employeeId
         ${typeClause}
       ORDER BY created_at DESC, id DESC
       LIMIT ${Number(limit)}`,
      params
    );

    return rows;
  }

  static async countUnreadByEmployeeId(employeeId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM notifications
       WHERE employee_id = :employeeId
         AND is_read = 0`,
      { employeeId }
    );

    return Number(rows[0]?.total) || 0;
  }

  static async findByIdForEmployee(id, employeeId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, employee_id, notification_type, title, description,
              reference_type, reference_id, is_read, read_at, created_at
       FROM notifications
       WHERE id = :id
         AND employee_id = :employeeId
       LIMIT 1`,
      { id, employeeId }
    );

    return rows[0] || null;
  }

  static async markAsRead(id, employeeId) {
    const pool = getPool();

    const [result] = await pool.execute(
      `UPDATE notifications
       SET is_read = 1, read_at = NOW()
       WHERE id = :id
         AND employee_id = :employeeId
         AND is_read = 0`,
      { id, employeeId }
    );

    return result.affectedRows > 0;
  }

  static async markAllAsRead(employeeId) {
    const pool = getPool();

    const [result] = await pool.execute(
      `UPDATE notifications
       SET is_read = 1, read_at = NOW()
       WHERE employee_id = :employeeId
         AND is_read = 0`,
      { employeeId }
    );

    return result.affectedRows;
  }

  static async existsTodayForReference(
    employeeId,
    { referenceType, referenceId, notificationType = "reminder" }
  ) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id
       FROM notifications
       WHERE employee_id = :employeeId
         AND notification_type = :notificationType
         AND reference_type = :referenceType
         AND reference_id = :referenceId
         AND DATE(created_at) = CURDATE()
       LIMIT 1`,
      {
        employeeId,
        notificationType,
        referenceType,
        referenceId,
      }
    );

    return Boolean(rows[0]);
  }
}

module.exports = Notification;
