const { getPool } = require("../config/database");

class CompanyPortalNewFacility {
  static async create(data, connection = null) {
    const db = connection || getPool();
    const [result] = await db.execute(
      `INSERT INTO company_portal_new_facility (
        company_user_id, company_portal_employee_id, portal_order_id,
        internal_facility_id, facility_name, facility_address,
        facility_city, facility_state, facility_zip, treating_doctor,
        search_fee_amount, status, created_at, updated_at
      ) VALUES (
        :companyUserId, :companyPortalEmployeeId, :portalOrderId,
        :internalFacilityId, :facilityName, :facilityAddress,
        :facilityCity, :facilityState, :facilityZip, :treatingDoctor,
        :searchFeeAmount, 'pending', NOW(), NOW()
      )`,
      data
    );

    return result.insertId;
  }

  static async linkToOrder(id, portalOrderId, connection = null) {
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_new_facility
       SET portal_order_id = :portalOrderId,
           status = 'linked',
           updated_at = NOW()
       WHERE id = :id`,
      { id, portalOrderId }
    );
  }

  static async findByOrderId(portalOrderId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT *
       FROM company_portal_new_facility
       WHERE portal_order_id = :portalOrderId
       ORDER BY id DESC
       LIMIT 1`,
      { portalOrderId }
    );
    return rows[0] || null;
  }

  static async findByPortalOrderIds(portalOrderIds = [], connection = null) {
    const ids = [
      ...new Set(
        (portalOrderIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ];
    if (!ids.length) return new Map();

    const db = connection || getPool();
    const placeholders = ids.map(() => "?").join(", ");
    const [rows] = await db.query(
      `SELECT *
       FROM company_portal_new_facility
       WHERE portal_order_id IN (${placeholders})
       ORDER BY id ASC`,
      ids
    );

    const map = new Map();
    for (const row of rows) {
      // Keep the most recent row per portal order.
      map.set(Number(row.portal_order_id), row);
    }
    return map;
  }

  static async markLinked(id, internalFacilityId, connection = null) {
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_new_facility
       SET status = 'linked',
           internal_facility_id = :internalFacilityId,
           updated_at = NOW()
       WHERE id = :id`,
      { id, internalFacilityId: internalFacilityId || null }
    );
    return this.findById(id, connection);
  }

  static async markCancelled(id, connection = null) {
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_new_facility
       SET status = 'cancelled',
           updated_at = NOW()
       WHERE id = :id`,
      { id }
    );
  }

  static async markInvoiceBilled(id, connection = null) {
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_new_facility
       SET invoice_billed_at = NOW(),
           updated_at = NOW()
       WHERE id = :id`,
      { id }
    );
  }

  static async findById(id, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT *
       FROM company_portal_new_facility
       WHERE id = :id
       LIMIT 1`,
      { id }
    );
    return rows[0] || null;
  }
}

module.exports = CompanyPortalNewFacility;
