/**
 * Record types requested for a personal request facility line
 * (personal_request_order_records).
 */

const { getPool } = require("../config/database");

class PersonalRequestOrderRecord {
  static async createMany(rows, connection = null) {
    if (!rows?.length) return [];

    const executor = connection || getPool();
    const placeholders = rows
      .map(
        (_, index) =>
          `(:personalRequestOrderId${index}, :personalRequestFacilityId${index}, :recordType${index})`
      )
      .join(", ");
    const params = {};
    rows.forEach((row, index) => {
      params[`personalRequestOrderId${index}`] = row.personalRequestOrderId;
      params[`personalRequestFacilityId${index}`] =
        row.personalRequestFacilityId;
      params[`recordType${index}`] = row.recordType;
    });

    const [result] = await executor.execute(
      `INSERT INTO personal_request_order_records (
        personal_request_order_id, personal_request_facility_id, record_type
      ) VALUES ${placeholders}`,
      params
    );

    const firstId = Number(result.insertId || 0);
    if (!firstId) return [];
    return rows.map((_, index) => firstId + index);
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
      `SELECT * FROM personal_request_order_records
       WHERE personal_request_order_id IN (${placeholders})
       ORDER BY personal_request_order_id ASC,
                FIELD(record_type, 'medical', 'billing', 'xrays'),
                id ASC`,
      params
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
