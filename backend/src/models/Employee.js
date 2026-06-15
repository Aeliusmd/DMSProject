const { getPool } = require("../config/database");

class Employee {
  static async findByEmailOrLogonForAuth(identifier) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, name, logon, email, password_hash, role, last_login_at,
              is_terminated, deleted_at, created_at, updated_at
       FROM matrix_employees
       WHERE email = :identifier OR logon = :identifier
       LIMIT 1`,
      { identifier }
    );

    return rows[0] || null;
  }

  static async findByEmailOrLogon(identifier) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, name, logon, email, password_hash, role, last_login_at,
              is_terminated, deleted_at, created_at, updated_at
       FROM matrix_employees
       WHERE (email = :identifier OR logon = :identifier)
         AND deleted_at IS NULL
         AND (is_terminated = 0 OR is_terminated IS NULL)
       LIMIT 1`,
      { identifier }
    );

    return rows[0] || null;
  }

  static async findById(id, { includeDeleted = false } = {}) {
    const pool = getPool();

    const deletedClause = includeDeleted ? "" : "AND deleted_at IS NULL";

    const [rows] = await pool.execute(
      `SELECT id, name, logon, email, role, last_login_at,
              is_terminated, deleted_at, deleted_by, created_at, updated_at
       FROM matrix_employees
       WHERE id = :id
         ${deletedClause}
       LIMIT 1`,
      { id }
    );

    return rows[0] || null;
  }

  static async findAll() {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, name, logon, email, role, last_login_at,
              is_terminated, deleted_at, created_at, updated_at
       FROM matrix_employees
       WHERE deleted_at IS NULL
       ORDER BY id DESC`
    );

    return rows;
  }

  static async findByEmail(email) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id FROM matrix_employees
       WHERE email = :email AND deleted_at IS NULL
       LIMIT 1`,
      { email }
    );

    return rows[0] || null;
  }

  static async findByLogon(logon) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id FROM matrix_employees
       WHERE logon = :logon AND deleted_at IS NULL
       LIMIT 1`,
      { logon }
    );

    return rows[0] || null;
  }

  static async create({
    name,
    logon,
    email,
    passwordHash,
    role,
  }) {
    const pool = getPool();

    const [result] = await pool.execute(
      `INSERT INTO matrix_employees
        (name, logon, email, password_hash, role, is_terminated, created_at, updated_at)
       VALUES
        (:name, :logon, :email, :passwordHash, :role, 0, NOW(), NOW())`,
      { name, logon, email, passwordHash, role }
    );

    return this.findById(result.insertId, { includeDeleted: true });
  }

  static async terminate(id) {
    const pool = getPool();

    await pool.execute(
      `UPDATE matrix_employees
       SET is_terminated = 1, updated_at = NOW()
       WHERE id = :id AND deleted_at IS NULL`,
      { id }
    );

    return this.findById(id, { includeDeleted: true });
  }

  static async activate(id) {
    const pool = getPool();

    await pool.execute(
      `UPDATE matrix_employees
       SET is_terminated = 0, updated_at = NOW()
       WHERE id = :id AND deleted_at IS NULL`,
      { id }
    );

    return this.findById(id, { includeDeleted: true });
  }

  static async softDelete(id, deletedBy) {
    const pool = getPool();

    await pool.execute(
      `UPDATE matrix_employees
       SET deleted_at = NOW(), deleted_by = :deletedBy, updated_at = NOW()
       WHERE id = :id AND deleted_at IS NULL`,
      { id, deletedBy }
    );
  }

  static async updateLastLogin(id) {
    const pool = getPool();

    await pool.execute(
      `UPDATE matrix_employees SET last_login_at = NOW(), updated_at = NOW() WHERE id = :id`,
      { id }
    );
  }
}

module.exports = Employee;
