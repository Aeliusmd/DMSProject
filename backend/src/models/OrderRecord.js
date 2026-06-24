/**
 * Per-type scanned records for an order (order_records table).
 */

const fs = require("fs");
const path = require("path");
const { getPool } = require("../config/database");
const fileStorage = require("../utils/fileStorage");
const { ORDER_UPLOADS_ROOT } = require("../middleware/uploadMiddleware");

function resolveStorageAbsolutePath(storagePath) {
  const normalized = String(storagePath || "").replace(/\\/g, "/");
  if (!normalized) return null;

  if (fileStorage.isUploadsRelativePath(normalized)) {
    return path.join(ORDER_UPLOADS_ROOT, normalized);
  }

  return fileStorage.resolveAbsolutePath(normalized);
}

class OrderRecord {
  static async findByOrderId(orderId, connection = null) {
    const db = connection || getPool();

    const [rows] = await db.execute(
      `SELECT id, order_id, record_type, storage_path, uploaded_by, uploaded_at,
              created_at, updated_at
       FROM order_records
       WHERE order_id = :orderId
       ORDER BY FIELD(record_type, 'medical', 'billing', 'employment', 'xrays', 'other')`,
      { orderId }
    );

    return rows;
  }

  static async findByOrderIds(orderIds = [], connection = null) {
    if (!orderIds.length) return [];

    const db = connection || getPool();
    const placeholders = orderIds.map((_, index) => `:id${index}`).join(", ");
    const params = orderIds.reduce((acc, id, index) => {
      acc[`id${index}`] = id;
      return acc;
    }, {});

    const [rows] = await db.execute(
      `SELECT id, order_id, record_type, storage_path, uploaded_by, uploaded_at,
              created_at, updated_at
       FROM order_records
       WHERE order_id IN (${placeholders})
       ORDER BY order_id, FIELD(record_type, 'medical', 'billing', 'employment', 'xrays', 'other')`,
      params
    );

    return rows;
  }

  static async findByOrderAndType(orderId, recordType, connection = null) {
    const db = connection || getPool();

    const [rows] = await db.execute(
      `SELECT id, order_id, record_type, storage_path, uploaded_by, uploaded_at,
              created_at, updated_at
       FROM order_records
       WHERE order_id = :orderId AND record_type = :recordType
       LIMIT 1`,
      { orderId, recordType }
    );

    return rows[0] || null;
  }

  static async syncForOrder(connection, orderId, recordTypes = []) {
    const normalized = [...new Set(recordTypes.filter(Boolean))];
    const existing = await OrderRecord.findByOrderId(orderId, connection);

    const removed = existing.filter(
      (record) => !normalized.includes(record.record_type)
    );

    for (const record of removed) {
      if (!record.storage_path) continue;

      const absolutePath = resolveStorageAbsolutePath(record.storage_path);
      if (absolutePath && fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }

    if (!normalized.length) {
      await connection.execute(
        `DELETE FROM order_records WHERE order_id = :orderId`,
        { orderId }
      );
      return;
    }

    const placeholders = normalized.map((_, index) => `:type${index}`).join(", ");
    const params = normalized.reduce((acc, type, index) => {
      acc[`type${index}`] = type;
      return acc;
    }, { orderId });

    await connection.execute(
      `DELETE FROM order_records
       WHERE order_id = :orderId
         AND record_type NOT IN (${placeholders})`,
      params
    );

    for (const recordType of normalized) {
      await connection.execute(
        `INSERT INTO order_records (order_id, record_type, created_at, updated_at)
         VALUES (:orderId, :recordType, NOW(), NOW())
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        { orderId, recordType }
      );
    }
  }

  static async upsertScan(
    connection,
    { orderId, recordType, storagePath, uploadedBy }
  ) {
    await connection.execute(
      `INSERT INTO order_records (
         order_id, record_type, storage_path, uploaded_by, uploaded_at, created_at, updated_at
       ) VALUES (
         :orderId, :recordType, :storagePath, :uploadedBy, NOW(), NOW(), NOW()
       )
       ON DUPLICATE KEY UPDATE
         storage_path = VALUES(storage_path),
         uploaded_by = VALUES(uploaded_by),
         uploaded_at = VALUES(uploaded_at),
         updated_at = NOW()`,
      { orderId, recordType, storagePath, uploadedBy: uploadedBy || null }
    );
  }

  static async clearScan(connection, orderId, recordType) {
    const existing = await OrderRecord.findByOrderAndType(orderId, recordType, connection);

    await connection.execute(
      `UPDATE order_records
       SET storage_path = NULL, uploaded_by = NULL, uploaded_at = NULL, updated_at = NOW()
       WHERE order_id = :orderId AND record_type = :recordType`,
      { orderId, recordType }
    );

    return existing;
  }
}

module.exports = OrderRecord;
