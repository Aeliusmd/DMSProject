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
        records_date_begin, records_date_end, sort_order
      ) VALUES (
        :personalRequestOrderId, :facilityId, :facilityName, :facilityAddress,
        :recordsDateBegin, :recordsDateEnd, :sortOrder
      )`,
      data
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

  static async findPrimaryByOrderId(personalRequestOrderId, connection = null) {
    const rows = await PersonalRequestFacility.findByOrderId(
      personalRequestOrderId,
      connection
    );
    return rows[0] || null;
  }
}

module.exports = PersonalRequestFacility;
