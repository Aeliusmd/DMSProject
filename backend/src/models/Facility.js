const { getPool } = require("../config/database");
const {
  normalizeFacilityName,
  normalizeZip,
  findFacilityByNameMatch,
} = require("../utils/facilityNameUtils");

class Facility {
  static async findAll(connection = null) {
    const pool = connection || getPool();

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

  static async findByNormalizedName(normalizedName, connection = null) {
    const db = connection || getPool();
    const normalized = normalizeFacilityName(normalizedName);

    if (!normalized) return null;

    try {
      const [rows] = await db.execute(
        `SELECT *
         FROM facilities
         WHERE is_active = 1
           AND name_normalized = :normalized
         LIMIT 1`,
        { normalized }
      );

      return rows[0] || null;
    } catch (error) {
      if (error.code === "ER_BAD_FIELD_ERROR") {
        return null;
      }

      throw error;
    }
  }

  static async findByZipCode(zipCode, connection = null) {
    const db = connection || getPool();
    const zip = normalizeZip(zipCode);

    if (!zip) return [];

    const [rows] = await db.execute(
      `SELECT *
       FROM facilities
       WHERE is_active = 1
         AND REPLACE(zip_code, ' ', '') LIKE :zipPrefix
       ORDER BY id DESC`,
      { zipPrefix: `${zip}%` }
    );

    return rows;
  }

  static async findBestMatch(
    { facilityName, city = "", state = "", zipCode = "", zip: zipInput = "" } = {},
    connection = null
  ) {
    const trimmedName = `${facilityName || ""}`.trim();

    if (!trimmedName) return null;

    const exact = await this.findByFacilityName(trimmedName, connection);
    if (exact) return exact;

    const normalizedMatch = await this.findByNormalizedName(
      trimmedName,
      connection
    );
    if (normalizedMatch) return normalizedMatch;

    const zip = normalizeZip(zipCode || zipInput);
    if (zip) {
      const candidates = await this.findByZipCode(zip, connection);
      const zipMatch = findFacilityByNameMatch(trimmedName, candidates);
      if (zipMatch) return zipMatch;
    }

    return null;
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
    const basePayload = { ...data };
    delete basePayload.nameNormalized;

    try {
      const [result] = await connection.execute(
        `INSERT INTO facilities (
          facility_name, name_normalized, slug, user_name, password_hash,
          contact_first_name, contact_middle_name, contact_last_name,
          address, zip_code, city, state, phone, fax, email, ip_addresses,
          is_active, is_auto_created, created_at, updated_at
        ) VALUES (
          :facilityName, :nameNormalized, :slug, :userName, :passwordHash,
          :contactFirstName, :contactMiddleName, :contactLastName,
          :address, :zipCode, :city, :state, :phone, :fax, :email, :ipAddresses,
          1, :isAutoCreated, NOW(), NOW()
        )`,
        data
      );

      return result.insertId;
    } catch (error) {
      if (error.code !== "ER_BAD_FIELD_ERROR") {
        throw error;
      }

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
        basePayload
      );

      return result.insertId;
    }
  }

  static async update(id, data) {
    const pool = getPool();
    const payload = { ...data, id };

    try {
      await pool.execute(
        `UPDATE facilities SET
          facility_name = :facilityName,
          name_normalized = :nameNormalized,
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
        payload
      );
    } catch (error) {
      if (error.code !== "ER_BAD_FIELD_ERROR") {
        throw error;
      }

      const legacyPayload = { ...payload };
      delete legacyPayload.nameNormalized;

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
        legacyPayload
      );
    }
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
