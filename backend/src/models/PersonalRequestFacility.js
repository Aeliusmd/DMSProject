/**
 * Treating facility line(s) for a personal request order
 * (personal_request_facilities).
 */

const { getPool } = require("../config/database");

class PersonalRequestFacility {
  static async create(data, connection = null) {
    const executor = connection || getPool();
    const [result] = await executor.execute(
      `INSERT INTO personal_request_facilities (
        personal_request_order_id, facility_id, facility_name, facility_address,
        treating_doctor, is_manual_lookup,
        records_date_begin, records_date_end, sort_order
      ) VALUES (
        :personalRequestOrderId, :facilityId, :facilityName, :facilityAddress,
        :treatingDoctor, :isManualLookup,
        :recordsDateBegin, :recordsDateEnd, :sortOrder
      )`,
      {
        personalRequestOrderId: data.personalRequestOrderId,
        facilityId: data.facilityId || null,
        facilityName: data.facilityName,
        facilityAddress: data.facilityAddress,
        treatingDoctor: data.treatingDoctor || null,
        isManualLookup: data.isManualLookup ? 1 : 0,
        recordsDateBegin: data.recordsDateBegin,
        recordsDateEnd: data.recordsDateEnd,
        sortOrder: data.sortOrder ?? 0,
      }
    );
    return result.insertId;
  }

  static async findByOrderId(personalRequestOrderId, connection = null) {
    const executor = connection || getPool();
    const [rows] = await executor.execute(
      `SELECT * FROM personal_request_facilities
       WHERE personal_request_order_id = :personalRequestOrderId
       ORDER BY sort_order ASC, id ASC`,
      { personalRequestOrderId }
    );
    return rows;
  }

  static async findByOrderIds(orderIds = [], connection = null) {
    const ids = [...new Set(orderIds.map(Number).filter((id) => id > 0))];
    if (!ids.length) return [];

    const executor = connection || getPool();
    const placeholders = ids.map((_, index) => `:id${index}`).join(", ");
    const params = {};
    ids.forEach((id, index) => {
      params[`id${index}`] = id;
    });

    const [rows] = await executor.execute(
      `SELECT * FROM personal_request_facilities
       WHERE personal_request_order_id IN (${placeholders})
       ORDER BY personal_request_order_id ASC, sort_order ASC, id ASC`,
      params
    );
    return rows;
  }

  static async findPrimaryByOrderId(personalRequestOrderId, connection = null) {
    const rows = await PersonalRequestFacility.findByOrderId(
      personalRequestOrderId,
      connection
    );
    return rows[0] || null;
  }

  static async markLinked(id, { facilityId, facilityName, facilityAddress }) {
    const pool = getPool();
    await pool.execute(
      `UPDATE personal_request_facilities
       SET facility_id = :facilityId,
           facility_name = COALESCE(:facilityName, facility_name),
           facility_address = COALESCE(:facilityAddress, facility_address),
           is_manual_lookup = 0
       WHERE id = :id`,
      {
        id,
        facilityId,
        facilityName: facilityName || null,
        facilityAddress: facilityAddress || null,
      }
    );
  }

  static async markCancelledManualLookup(id) {
    const pool = getPool();
    await pool.execute(
      `UPDATE personal_request_facilities
       SET is_manual_lookup = 0
       WHERE id = :id`,
      { id }
    );
  }

  static async markPendingManualLookup(id) {
    const pool = getPool();
    await pool.execute(
      `UPDATE personal_request_facilities
       SET is_manual_lookup = 1
       WHERE id = :id`,
      { id }
    );
  }
}

module.exports = PersonalRequestFacility;
