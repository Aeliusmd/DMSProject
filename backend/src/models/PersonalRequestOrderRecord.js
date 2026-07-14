/**
 * Record types requested for a personal request facility line
 * (personal_request_order_records).
 */

const { getPool } = require("../config/database");

class PersonalRequestOrderRecord {
  static async createMany(rows, connection = null) {
    if (!rows?.length) return [];

    const executor = connection || getPool();
    const insertedIds = [];

    for (const row of rows) {
      const [result] = await executor.execute(
        `INSERT INTO personal_request_order_records (
          personal_request_order_id, personal_request_facility_id, record_type
        ) VALUES (
          :personalRequestOrderId, :personalRequestFacilityId, :recordType
        )`,
        row
      );
      insertedIds.push(result.insertId);
    }

    return insertedIds;
  }

  static async findByOrderId(personalRequestOrderId, connection = null) {
    const executor = connection || getPool();
    const [rows] = await executor.execute(
      `SELECT * FROM personal_request_order_records
       WHERE personal_request_order_id = :personalRequestOrderId
       ORDER BY FIELD(record_type, 'medical', 'billing', 'xrays'), id ASC`,
      { personalRequestOrderId }
    );
    return rows;
  }

  static async findByFacilityId(personalRequestFacilityId, connection = null) {
    const executor = connection || getPool();
    const [rows] = await executor.execute(
      `SELECT * FROM personal_request_order_records
       WHERE personal_request_facility_id = :personalRequestFacilityId
       ORDER BY FIELD(record_type, 'medical', 'billing', 'xrays'), id ASC`,
      { personalRequestFacilityId }
    );
    return rows;
  }

  static async getRecordTypesForOrder(personalRequestOrderId, connection = null) {
    const rows = await PersonalRequestOrderRecord.findByOrderId(
      personalRequestOrderId,
      connection
    );
    return [...new Set(rows.map((row) => row.record_type).filter(Boolean))];
  }
}

module.exports = PersonalRequestOrderRecord;
