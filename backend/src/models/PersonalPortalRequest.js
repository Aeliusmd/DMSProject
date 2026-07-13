const { getPool } = require("../config/database");

class PersonalPortalRequest {
  static async create(data) {
    const pool = getPool();
    const [result] = await pool.execute(
      `INSERT INTO personal_portal_requests (
        email, driver_license_number, driver_license_storage_path,
        first_name, last_name, dob,
        treating_facility_name, treating_facility_address,
        records_date_begin, records_date_end, record_types_json,
        delivery_preference, mail_address,
        portal_status, stripe_checkout_session_id
      ) VALUES (
        :email, :driverLicenseNumber, :driverLicenseStoragePath,
        :firstName, :lastName, :dob,
        :treatingFacilityName, :treatingFacilityAddress,
        :recordsDateBegin, :recordsDateEnd, :recordTypesJson,
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
      `SELECT * FROM personal_portal_requests WHERE id = :id LIMIT 1`,
      { id }
    );
    return rows[0] || null;
  }

  static async findByConfirmationReference(reference) {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT * FROM personal_portal_requests
       WHERE confirmation_reference = :reference LIMIT 1`,
      { reference }
    );
    return rows[0] || null;
  }

  static async findByDriverLicenseNumber(number) {
    const pool = getPool();
    const normalized = `${number || ""}`.trim();
    const [rows] = await pool.execute(
      `SELECT * FROM personal_portal_requests
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
      `SELECT * FROM personal_portal_requests
       WHERE stripe_checkout_session_id = :sessionId LIMIT 1`,
      { sessionId }
    );
    return rows[0] || null;
  }

  static async markPaid(connection, id, data) {
    const executor = connection || getPool();
    await executor.execute(
      `UPDATE personal_portal_requests
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
      `UPDATE personal_portal_requests
       SET portal_status = :portalStatus, updated_at = NOW()
       WHERE id = :id`,
      { id, portalStatus }
    );
  }

  static async setReleasedDownloadToken(id, token, connection = null) {
    const executor = connection || getPool();
    await executor.execute(
      `UPDATE personal_portal_requests
       SET portal_status = 'released',
           released_download_token = :token,
           updated_at = NOW()
       WHERE id = :id`,
      { id, token }
    );
  }
}

module.exports = PersonalPortalRequest;
