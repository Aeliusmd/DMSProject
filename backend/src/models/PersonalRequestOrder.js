/**
 * Personal request order header (personal_request_orders).
 * Facility lines and record types live in related tables.
 */

const { getPool } = require("../config/database");

class PersonalRequestOrder {
  static async create(data, connection = null) {
    const executor = connection || getPool();
    const [result] = await executor.execute(
      `INSERT INTO personal_request_orders (
        portal_user_id, email, driver_license_number, driver_license_storage_path,
        first_name, last_name, dob,
        delivery_preference, mail_address,
        portal_status, stripe_checkout_session_id
      ) VALUES (
        :portalUserId, :email, :driverLicenseNumber, :driverLicenseStoragePath,
        :firstName, :lastName, :dob,
        :deliveryPreference, :mailAddress,
        :portalStatus, :stripeCheckoutSessionId
      )`,
      data
    );
    return result.insertId;
  }

  static async findByPortalUserId(portalUserId, { limit = 20 } = {}) {
    const pool = getPool();
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const [rows] = await pool.execute(
      `SELECT o.*,
              (
                SELECT prf.facility_name
                FROM personal_request_facilities prf
                WHERE prf.personal_request_order_id = o.id
                ORDER BY prf.sort_order ASC, prf.id ASC
                LIMIT 1
              ) AS treating_facility_name
       FROM personal_request_orders o
       WHERE o.portal_user_id = :portalUserId
       ORDER BY o.created_at DESC
       LIMIT ${safeLimit}`,
      { portalUserId }
    );
    return rows;
  }

  static async countByPortalUserId(portalUserId) {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN portal_status = 'in_process' THEN 1 ELSE 0 END) AS in_process,
         SUM(CASE WHEN portal_status = 'invoice' THEN 1 ELSE 0 END) AS invoice,
         SUM(CASE WHEN portal_status = 'paid' THEN 1 ELSE 0 END) AS paid,
         SUM(CASE WHEN portal_status = 'released' THEN 1 ELSE 0 END) AS released
       FROM personal_request_orders
       WHERE portal_user_id = :portalUserId
         AND processing_fee_paid = 1`,
      { portalUserId }
    );
    return rows[0] || {};
  }

  static async findStaffList(filters = {}) {
    const pool = getPool();
    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 20, 1), 100);
    const page = Math.max(Number(filters.page) || 1, 1);
    const offset = (page - 1) * pageSize;

    const conditions = ["o.processing_fee_paid = 1"];
    const params = {};

    const search = `${filters.search || ""}`.trim();
    if (search) {
      conditions.push(`(
        o.confirmation_reference LIKE :search
        OR o.first_name LIKE :search
        OR o.last_name LIKE :search
        OR o.email LIKE :search
        OR o.driver_license_number LIKE :search
        OR EXISTS (
          SELECT 1 FROM personal_request_facilities prf
          WHERE prf.personal_request_order_id = o.id
            AND prf.facility_name LIKE :search
        )
      )`);
      params.search = `%${search}%`;
    }

    if (filters.status) {
      conditions.push("o.portal_status = :status");
      params.status = filters.status;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM personal_request_orders o
       ${whereClause}`,
      params
    );

    const [rows] = await pool.execute(
      `SELECT o.*,
              (
                SELECT prf.facility_name
                FROM personal_request_facilities prf
                WHERE prf.personal_request_order_id = o.id
                ORDER BY prf.sort_order ASC, prf.id ASC
                LIMIT 1
              ) AS treating_facility_name,
              (
                SELECT prf.facility_address
                FROM personal_request_facilities prf
                WHERE prf.personal_request_order_id = o.id
                ORDER BY prf.sort_order ASC, prf.id ASC
                LIMIT 1
              ) AS treating_facility_address,
              (
                SELECT prf.records_date_begin
                FROM personal_request_facilities prf
                WHERE prf.personal_request_order_id = o.id
                ORDER BY prf.sort_order ASC, prf.id ASC
                LIMIT 1
              ) AS records_date_begin,
              (
                SELECT prf.records_date_end
                FROM personal_request_facilities prf
                WHERE prf.personal_request_order_id = o.id
                ORDER BY prf.sort_order ASC, prf.id ASC
                LIMIT 1
              ) AS records_date_end,
              (
                SELECT GROUP_CONCAT(DISTINCT prer.record_type ORDER BY prer.record_type SEPARATOR ',')
                FROM personal_request_order_records prer
                WHERE prer.personal_request_order_id = o.id
              ) AS record_types
       FROM personal_request_orders o
       ${whereClause}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    return {
      rows,
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
    };
  }

  static async findPortalStatusesByOrderIds(orderIds = []) {
    if (!orderIds.length) return {};
    const pool = getPool();
    const placeholders = orderIds.map((_, index) => `:id${index}`).join(", ");
    const params = {};
    orderIds.forEach((id, index) => {
      params[`id${index}`] = id;
    });
    const [rows] = await pool.execute(
      `SELECT order_id, portal_status
       FROM personal_request_orders
       WHERE order_id IN (${placeholders})`,
      params
    );
    return rows.reduce((acc, row) => {
      if (row.order_id) acc[row.order_id] = row;
      return acc;
    }, {});
  }

  static async countPaidStats() {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN portal_status = 'in_process' THEN 1 ELSE 0 END) AS in_process,
         SUM(CASE WHEN portal_status = 'invoice' THEN 1 ELSE 0 END) AS invoice,
         SUM(CASE WHEN portal_status = 'paid' THEN 1 ELSE 0 END) AS paid,
         SUM(CASE WHEN portal_status = 'released' THEN 1 ELSE 0 END) AS released
       FROM personal_request_orders
       WHERE processing_fee_paid = 1`
    );
    return rows[0] || {};
  }

  static async findPaidWithoutOrderId({ limit = 20 } = {}) {
    const pool = getPool();
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const [rows] = await pool.execute(
      `SELECT id FROM personal_request_orders
       WHERE processing_fee_paid = 1
         AND (order_id IS NULL OR order_id = 0)
       ORDER BY id ASC
       LIMIT ${safeLimit}`
    );
    return rows;
  }

  static async findById(id) {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT * FROM personal_request_orders WHERE id = :id LIMIT 1`,
      { id }
    );
    return rows[0] || null;
  }

  static async findByOrderId(orderId, connection = null) {
    const executor = connection || getPool();
    const [rows] = await executor.execute(
      `SELECT * FROM personal_request_orders
       WHERE order_id = :orderId
       ORDER BY id DESC
       LIMIT 1`,
      { orderId }
    );
    return rows[0] || null;
  }

  static async findByConfirmationReference(reference) {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT * FROM personal_request_orders
       WHERE confirmation_reference = :reference LIMIT 1`,
      { reference }
    );
    return rows[0] || null;
  }

  static async findByDriverLicenseNumber(number) {
    const pool = getPool();
    const normalized = `${number || ""}`.trim();
    const [rows] = await pool.execute(
      `SELECT * FROM personal_request_orders
       WHERE driver_license_number = :number
       ORDER BY created_at DESC
       LIMIT 1`,
      { number: normalized }
    );
    return rows[0] || null;
  }

  static async findByStripeSessionId(sessionId) {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT * FROM personal_request_orders
       WHERE stripe_checkout_session_id = :sessionId LIMIT 1`,
      { sessionId }
    );
    return rows[0] || null;
  }

  static async setStripeCheckoutSessionId(id, sessionId, connection = null) {
    const executor = connection || getPool();
    await executor.execute(
      `UPDATE personal_request_orders
       SET stripe_checkout_session_id = :sessionId, updated_at = NOW()
       WHERE id = :id`,
      { id, sessionId }
    );
  }

  static async markPaid(connection, id, data) {
    const executor = connection || getPool();
    await executor.execute(
      `UPDATE personal_request_orders
       SET confirmation_reference = :confirmationReference,
           order_id = :orderId,
           portal_status = :portalStatus,
           processing_fee_paid = 1,
           lookup_expires_at = :lookupExpiresAt,
           updated_at = NOW()
       WHERE id = :id`,
      {
        id,
        confirmationReference: data.confirmationReference,
        orderId: data.orderId ?? null,
        portalStatus: data.portalStatus,
        lookupExpiresAt: data.lookupExpiresAt,
      }
    );
  }

  static async updatePortalStatus(id, portalStatus, connection = null) {
    const executor = connection || getPool();
    await executor.execute(
      `UPDATE personal_request_orders
       SET portal_status = :portalStatus, updated_at = NOW()
       WHERE id = :id`,
      { id, portalStatus }
    );
  }

  static async setReleasedDownloadToken(id, token, connection = null) {
    const executor = connection || getPool();
    await executor.execute(
      `UPDATE personal_request_orders
       SET portal_status = 'released',
           released_download_token = :token,
           updated_at = NOW()
       WHERE id = :id`,
      { id, token }
    );
  }
}

module.exports = PersonalRequestOrder;
