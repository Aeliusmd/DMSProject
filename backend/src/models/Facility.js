const { getPool } = require("../config/database");

class Facility {
  static async findAll() {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, facility_name, city, zip_code, state, email, phone, is_active, is_auto_created
       FROM facilities
       WHERE is_active = 1
       ORDER BY id DESC`
    );

    return rows;
  }

  static async findById(id, connection = null) {
    const db = connection || getPool();

    const [rows] = await db.execute(
      `SELECT *
       FROM facilities
       WHERE id = :id AND is_active = 1
       LIMIT 1`,
      { id }
    );

    return rows[0] || null;
  }

  static async findByFacilityName(facilityName, connection = null) {
    const db = connection || getPool();
    const trimmed = `${facilityName || ""}`.trim();

    if (!trimmed) return null;

    const [rows] = await db.execute(
      `SELECT *
       FROM facilities
       WHERE is_active = 1
         AND LOWER(TRIM(facility_name)) = LOWER(TRIM(:facilityName))
       LIMIT 1`,
      { facilityName: trimmed }
    );

    return rows[0] || null;
  }

  static async search(query, limit = 10) {
    const pool = getPool();
    const trimmed = `${query || ""}`.trim();

    if (!trimmed) return [];

    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);

    const [rows] = await pool.execute(
      `SELECT id, facility_name, city, zip_code, state, email, phone, is_active, is_auto_created
       FROM facilities
       WHERE is_active = 1
         AND LOWER(facility_name) LIKE :query
       ORDER BY facility_name ASC
       LIMIT ${safeLimit}`,
      { query: `%${trimmed.toLowerCase()}%` }
    );

    return rows;
  }

  static async findByUserName(userName, excludeId = null) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id FROM facilities
       WHERE user_name = :userName
         AND is_active = 1
         ${excludeId ? "AND id <> :excludeId" : ""}
       LIMIT 1`,
      { userName, excludeId }
    );

    return rows[0] || null;
  }

  static async create(connection, data) {
    const [result] = await connection.execute(
      `INSERT INTO facilities (
        facility_name, slug, user_name, password_hash,
        contact_first_name, contact_middle_name, contact_last_name,
        address, zip_code, city, state, phone, fax, email, ip_addresses,
        is_active, is_auto_created, created_at, updated_at
      ) VALUES (
        :facilityName, :slug, :userName, :passwordHash,
        :contactFirstName, :contactMiddleName, :contactLastName,
        :address, :zipCode, :city, :state, :phone, :fax, :email, :ipAddresses,
        1, :isAutoCreated, NOW(), NOW()
      )`,
      data
    );

    return result.insertId;
  }

  static async update(id, data) {
    const pool = getPool();

    await pool.execute(
      `UPDATE facilities SET
        facility_name = :facilityName,
        slug = :slug,
        contact_first_name = :contactFirstName,
        contact_middle_name = :contactMiddleName,
        contact_last_name = :contactLastName,
        address = :address,
        zip_code = :zipCode,
        city = :city,
        state = :state,
        phone = :phone,
        fax = :fax,
        email = :email,
        ip_addresses = :ipAddresses,
        is_auto_created = :isAutoCreated,
        updated_at = NOW()
       WHERE id = :id AND is_active = 1`,
      { ...data, id }
    );
  }

  static async deactivate(id) {
    const pool = getPool();

    await pool.execute(
      `UPDATE facilities SET is_active = 0, updated_at = NOW() WHERE id = :id`,
      { id }
    );
  }
}

module.exports = Facility;
