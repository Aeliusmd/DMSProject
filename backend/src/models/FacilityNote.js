const { getPool } = require("../config/database");

class FacilityNote {
  static async findByFacilityId(facilityId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, facility_id, note_date, created_by, author_name, note,
              created_at, updated_at
       FROM facility_notes
       WHERE facility_id = :facilityId
       ORDER BY note_date DESC, id DESC`,
      { facilityId }
    );

    return rows;
  }

  static async create(data) {
    const pool = getPool();

    const [result] = await pool.execute(
      `INSERT INTO facility_notes (
        facility_id, note_date, created_by, author_name, note, created_at, updated_at
      ) VALUES (
        :facilityId, :noteDate, :createdBy, :authorName, :note, NOW(), NOW()
      )`,
      data
    );

    const [rows] = await pool.execute(
      `SELECT id, facility_id, note_date, created_by, author_name, note,
              created_at, updated_at
       FROM facility_notes
       WHERE id = :id
       LIMIT 1`,
      { id: result.insertId }
    );

    return rows[0] || null;
  }
}

module.exports = FacilityNote;
