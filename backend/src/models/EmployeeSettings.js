const { getPool } = require("../config/database");

const DEFAULT_PREFERENCES = {
  notifyNewOrders: 1,
  notifyInvoiceReminders: 1,
  notifyEmployeeActivity: 1,
  notifyCaseStatus: 1,
};

class EmployeeSettings {
  static async findByEmployeeId(employeeId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, employee_id, notify_new_orders, notify_invoice_reminders,
              notify_employee_activity, notify_case_status, created_at, updated_at
       FROM employee_settings
       WHERE employee_id = :employeeId
       LIMIT 1`,
      { employeeId }
    );

    return rows[0] || null;
  }

  static async upsert(employeeId, data) {
    const pool = getPool();
    const existing = await this.findByEmployeeId(employeeId);

    if (existing) {
      await pool.execute(
        `UPDATE employee_settings SET
          notify_new_orders = :notifyNewOrders,
          notify_invoice_reminders = :notifyInvoiceReminders,
          notify_employee_activity = :notifyEmployeeActivity,
          notify_case_status = :notifyCaseStatus,
          updated_at = NOW()
         WHERE employee_id = :employeeId`,
        { employeeId, ...data }
      );

      return this.findByEmployeeId(employeeId);
    }

    await pool.execute(
      `INSERT INTO employee_settings (
        employee_id, notify_new_orders, notify_invoice_reminders,
        notify_employee_activity, notify_case_status, created_at, updated_at
      ) VALUES (
        :employeeId, :notifyNewOrders, :notifyInvoiceReminders,
        :notifyEmployeeActivity, :notifyCaseStatus, NOW(), NOW()
      )`,
      { employeeId, ...data }
    );

    return this.findByEmployeeId(employeeId);
  }

  static async createDefaults(employeeId) {
    const existing = await this.findByEmployeeId(employeeId);

    if (existing) {
      return existing;
    }

    const pool = getPool();

    await pool.execute(
      `INSERT INTO employee_settings (
        employee_id, notify_new_orders, notify_invoice_reminders,
        notify_employee_activity, notify_case_status, created_at, updated_at
      ) VALUES (
        :employeeId, :notifyNewOrders, :notifyInvoiceReminders,
        :notifyEmployeeActivity, :notifyCaseStatus, NOW(), NOW()
      )`,
      { employeeId, ...DEFAULT_PREFERENCES }
    );

    return this.findByEmployeeId(employeeId);
  }

  static hasUnsetPreferences(row) {
    if (!row) return true;

    return [
      row.notify_new_orders,
      row.notify_invoice_reminders,
      row.notify_employee_activity,
      row.notify_case_status,
    ].every((value) => value === null || value === undefined);
  }

  static async ensureForEmployee(employeeId) {
    const existing = await this.findByEmployeeId(employeeId);

    if (!existing) {
      return this.createDefaults(employeeId);
    }

    if (this.hasUnsetPreferences(existing)) {
      return this.upsert(employeeId, DEFAULT_PREFERENCES);
    }

    return existing;
  }
}

EmployeeSettings.DEFAULT_PREFERENCES = DEFAULT_PREFERENCES;

module.exports = EmployeeSettings;
