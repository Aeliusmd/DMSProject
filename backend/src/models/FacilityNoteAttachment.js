const { getPool } = require("../config/database");

class FacilityNoteAttachment {
  static async findByNoteIds(noteIds = []) {
    if (!noteIds.length) return [];

    const pool = getPool();
    const placeholders = noteIds.map(() => "?").join(", ");

    const [rows] = await pool.execute(
      `SELECT id, facility_note_id, storage_path, original_filename,
              mime_type, file_size_bytes, created_at
       FROM facility_note_attachments
       WHERE facility_note_id IN (${placeholders})
       ORDER BY id ASC`,
      noteIds
    );

    return rows;
  }

  static async findById(id, facilityNoteId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, facility_note_id, storage_path, original_filename,
              mime_type, file_size_bytes, created_at
       FROM facility_note_attachments
       WHERE id = :id AND facility_note_id = :facilityNoteId
       LIMIT 1`,
      { id, facilityNoteId }
    );

    return rows[0] || null;
  }

  static async createMany(attachments = [], connection = null) {
    if (!attachments.length) return [];

    const db = connection || getPool();
    const ids = [];

    for (const attachment of attachments) {
      const [result] = await db.execute(
        `INSERT INTO facility_note_attachments (
          facility_note_id, storage_path, original_filename,
          mime_type, file_size_bytes, created_at
        ) VALUES (
          :facilityNoteId, :storagePath, :originalFilename,
          :mimeType, :fileSizeBytes, NOW()
        )`,
        attachment
      );

      ids.push(result.insertId);
    }

    if (!ids.length) return [];

    const placeholders = ids.map(() => "?").join(", ");
    const [rows] = await db.execute(
      `SELECT id, facility_note_id, storage_path, original_filename,
              mime_type, file_size_bytes, created_at
       FROM facility_note_attachments
       WHERE id IN (${placeholders})
       ORDER BY id ASC`,
      ids
    );

    return rows;
  }
}

module.exports = FacilityNoteAttachment;
