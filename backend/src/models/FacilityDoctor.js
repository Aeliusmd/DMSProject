const { getPool } = require("../config/database");

class FacilityDoctor {
  static async findByFacilityId(facilityId, { activeOnly = false } = {}) {
    const pool = getPool();

    const activeClause = activeOnly ? "AND is_active = 1" : "";

    const [rows] = await pool.execute(
      `SELECT *
       FROM facility_doctors
       WHERE facility_id = :facilityId
         ${activeClause}
       ORDER BY id ASC`,
      { facilityId }
    );

    return rows;
  }

  static async findById(id, facilityId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT * FROM facility_doctors
       WHERE id = :id AND facility_id = :facilityId
       LIMIT 1`,
      { id, facilityId }
    );

    return rows[0] || null;
  }

  static async create(connection, data) {
    const [result] = await connection.execute(
      `INSERT INTO facility_doctors (
        facility_id, office_name, first_name, middle_name, last_name,
        phone, fax, email, is_default, is_active, created_at, updated_at
      ) VALUES (
        :facilityId, :officeName, :firstName, :middleName, :lastName,
        :phone, :fax, :email, :isDefault, 1, NOW(), NOW()
      )`,
      data
    );

    return result.insertId;
  }

  static async clearDefaultForFacility(facilityId, connection = null) {
    const executor = connection || getPool();

    await executor.execute(
      `UPDATE facility_doctors SET is_default = 0, updated_at = NOW()
       WHERE facility_id = :facilityId`,
      { facilityId }
    );
  }

  static async setDefault(id, facilityId) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await this.clearDefaultForFacility(facilityId, connection);

      await connection.execute(
        `UPDATE facility_doctors
         SET is_default = 1, updated_at = NOW()
         WHERE id = :id AND facility_id = :facilityId AND is_active = 1`,
        { id, facilityId }
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async setActiveStatus(id, facilityId, isActive) {
    const pool = getPool();

    await pool.execute(
      `UPDATE facility_doctors
       SET is_active = :isActive, updated_at = NOW()
       WHERE id = :id AND facility_id = :facilityId`,
      { id, facilityId, isActive: isActive ? 1 : 0 }
    );
  }

  static async getNextDefaultCandidate(facilityId, excludeId = null) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id FROM facility_doctors
       WHERE facility_id = :facilityId
         AND is_active = 1
         ${excludeId ? "AND id <> :excludeId" : ""}
       ORDER BY id ASC
       LIMIT 1`,
      { facilityId, excludeId }
    );

    return rows[0] || null;
  }
}

module.exports = FacilityDoctor;
