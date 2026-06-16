const { getPool } = require("../config/database");

class OfficeManager {
  static async findByFacilityId(facilityId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, facility_id, first_name, middle_name, last_name, phone, email
       FROM office_managers
       WHERE facility_id = :facilityId AND (is_deleted = 0 OR is_deleted IS NULL)
       ORDER BY id ASC`,
      { facilityId }
    );

    return rows;
  }

  static async create(connection, data) {
    const [result] = await connection.execute(
      `INSERT INTO office_managers (
        facility_id, first_name, middle_name, last_name, phone, email,
        is_deleted, created_at, updated_at
      ) VALUES (
        :facilityId, :firstName, :middleName, :lastName, :phone, :email,
        0, NOW(), NOW()
      )`,
      data
    );

    return result.insertId;
  }

  static async update(id, data) {
    const pool = getPool();

    await pool.execute(
      `UPDATE office_managers SET
        first_name = :firstName,
        middle_name = :middleName,
        last_name = :lastName,
        phone = :phone,
        email = :email,
        updated_at = NOW()
       WHERE id = :id AND (is_deleted = 0 OR is_deleted IS NULL)`,
      { ...data, id }
    );
  }

  static async softDeleteMissing(facilityId, keepIds, deletedBy) {
    const pool = getPool();

    if (keepIds.length === 0) {
      await pool.execute(
        `UPDATE office_managers
         SET is_deleted = 1, deleted_at = NOW(), deleted_by = :deletedBy, updated_at = NOW()
         WHERE facility_id = :facilityId AND (is_deleted = 0 OR is_deleted IS NULL)`,
        { facilityId, deletedBy }
      );
      return;
    }

    const placeholders = keepIds.map((_, index) => `:keepId${index}`).join(", ");
    const params = { facilityId, deletedBy };

    keepIds.forEach((keepId, index) => {
      params[`keepId${index}`] = keepId;
    });

    await pool.execute(
      `UPDATE office_managers
       SET is_deleted = 1, deleted_at = NOW(), deleted_by = :deletedBy, updated_at = NOW()
       WHERE facility_id = :facilityId
         AND (is_deleted = 0 OR is_deleted IS NULL)
         AND id NOT IN (${placeholders})`,
      params
    );
  }
}

module.exports = OfficeManager;
