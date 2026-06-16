const { getPool } = require("../config/database");

class Facility {
  static async findAll() {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, facility_name, city, zip_code, state, email, phone, is_active
       FROM facilities
       WHERE is_active = 1
       ORDER BY id DESC`
    );

    return rows;
  }

  static async findById(id) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT *
       FROM facilities
       WHERE id = :id AND is_active = 1
       LIMIT 1`,
      { id }
    );

    return rows[0] || null;
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
        is_active, created_at, updated_at
      ) VALUES (
        :facilityName, :slug, :userName, :passwordHash,
        :contactFirstName, :contactMiddleName, :contactLastName,
        :address, :zipCode, :city, :state, :phone, :fax, :email, :ipAddresses,
        1, NOW(), NOW()
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
        user_name = :userName,
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
        updated_at = NOW()
        ${data.passwordHash ? ", password_hash = :passwordHash" : ""}
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
