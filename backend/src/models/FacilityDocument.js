const path = require("path");
const { getPool } = require("../config/database");

class FacilityDocument {
  static async findByFacilityId(facilityId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, facility_id, document_name, upload_type, file_type,
              storage_path, file_size_bytes, uploaded_by, uploaded_at,
              created_at, updated_at
       FROM facility_documents
       WHERE facility_id = :facilityId
         AND (is_deleted = 0 OR is_deleted IS NULL)
       ORDER BY uploaded_at DESC, id DESC`,
      { facilityId }
    );

    return rows;
  }

  static async findById(id, facilityId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT *
       FROM facility_documents
       WHERE id = :id
         AND facility_id = :facilityId
         AND (is_deleted = 0 OR is_deleted IS NULL)
       LIMIT 1`,
      { id, facilityId }
    );

    return rows[0] || null;
  }

  static async create(data) {
    const pool = getPool();

    const [result] = await pool.execute(
      `INSERT INTO facility_documents (
        facility_id, document_name, upload_type, file_type, storage_path,
        file_size_bytes, uploaded_by, uploaded_at, is_deleted, created_at, updated_at
      ) VALUES (
        :facilityId, :documentName, :uploadType, :fileType, :storagePath,
        :fileSizeBytes, :uploadedBy, NOW(), 0, NOW(), NOW()
      )`,
      data
    );

    return result.insertId;
  }

  static async softDelete(id, facilityId, deletedBy) {
    const pool = getPool();

    await pool.execute(
      `UPDATE facility_documents
       SET is_deleted = 1,
           deleted_at = NOW(),
           deleted_by = :deletedBy,
           updated_at = NOW()
       WHERE id = :id
         AND facility_id = :facilityId
         AND (is_deleted = 0 OR is_deleted IS NULL)`,
      { id, facilityId, deletedBy }
    );
  }
}

module.exports = FacilityDocument;

function getFileTypeFromName(fileName) {
  const extension = path.extname(fileName || "").replace(".", "").toUpperCase();
  return extension || "FILE";
}

FacilityDocument.getFileTypeFromName = getFileTypeFromName;
