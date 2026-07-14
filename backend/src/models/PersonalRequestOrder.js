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
        email, driver_license_number, driver_license_storage_path,
        first_name, last_name, dob,
        delivery_preference, mail_address,
        portal_status, stripe_checkout_session_id
      ) VALUES (
        :email, :driverLicenseNumber, :driverLicenseStoragePath,
        :firstName, :lastName, :dob,
        :deliveryPreference, :mailAddress,
        :portalStatus, :stripeCheckoutSessionId
      )`,
      data
    );
    return result.insertId;
  }

  static async findById(id) {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT * FROM personal_request_orders WHERE id = :id LIMIT 1`,
      { id }
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
      { id, ...data }
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
