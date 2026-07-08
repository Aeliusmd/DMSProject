const { getPool } = require("../config/database");

class Employee {
  static async findByEmailOrLogonForAuth(identifier) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, name, logon, email, password_hash, role, last_login_at,
              is_terminated, is_suspended, suspended_by, reactivated_date,
              deleted_at, created_at, updated_at
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
              is_terminated, is_suspended, suspended_by, reactivated_date,
              deleted_at, created_at, updated_at
       FROM matrix_employees
       WHERE (email = :identifier OR logon = :identifier)
         AND deleted_at IS NULL
         AND (is_terminated = 0 OR is_terminated IS NULL)
         AND (is_suspended = 0 OR is_suspended IS NULL)
       LIMIT 1`,
      { identifier }
    );

    return rows[0] || null;
  }

  static async findById(id, { includeDeleted = false } = {}) {
    const pool = getPool();

    const deletedClause = includeDeleted ? "" : "AND deleted_at IS NULL";

    const [rows] = await pool.execute(
      `SELECT id, name, logon, email, password_hash, role, last_login_at,
              is_terminated, is_suspended, suspended_by, reactivated_date,
              deleted_at, deleted_by, created_at, updated_at
       FROM matrix_employees
       WHERE id = :id
         ${deletedClause}
       LIMIT 1`,
      { id }
    );

    return rows[0] || null;
  }

  static async findByIdPublic(id) {
    const employee = await this.findById(id);

    if (!employee) return null;

    const { password_hash, ...publicEmployee } = employee;
    return publicEmployee;
  }

  static async findAll(filters = {}) {
    const pool = getPool();
    const conditions = ["deleted_at IS NULL"];
    const params = {};

    if (filters.search) {
      conditions.push("name LIKE :searchPrefix");
      params.searchPrefix = `${Employee.escapeLikePrefix(filters.search)}%`;
    }

    const limit =
      filters.limit && Number(filters.limit) > 0
        ? Math.min(Number(filters.limit), 500)
        : null;
    const limitClause = limit ? `LIMIT ${limit}` : "";

    const [rows] = await pool.execute(
      `SELECT id, name, logon, email, role, last_login_at,
              is_terminated, is_suspended, suspended_by, reactivated_date,
              deleted_at, created_at, updated_at
       FROM matrix_employees
       WHERE ${conditions.join(" AND ")}
       ORDER BY id DESC
       ${limitClause}`,
      params
    );

    return rows;
  }

  static async findAllKeyset(filters = {}) {
    const pool = getPool();
    const conditions = ["deleted_at IS NULL"];
    const params = {};

    if (filters.search) {
      conditions.push("name LIKE :searchPrefix");
      params.searchPrefix = `${Employee.escapeLikePrefix(filters.search)}%`;
    }

    const cursorId =
      Number(filters.cursorId) > 0 ? Number(filters.cursorId) : null;
    if (cursorId) {
      conditions.push("id < :cursorId");
      params.cursorId = cursorId;
    }

    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 100);
    const queryLimit = pageSize + 1;

    const [rows] = await pool.execute(
      `SELECT id, name, logon, email, role, last_login_at,
              is_terminated, is_suspended, suspended_by, reactivated_date,
              deleted_at, created_at, updated_at
       FROM matrix_employees
       WHERE ${conditions.join(" AND ")}
       ORDER BY id DESC
       LIMIT ${queryLimit}`,
      params
    );

    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.id || null : null;

    return {
      rows: pageRows,
      pageSize,
      hasMore,
      nextCursor,
    };
  }

  static async findByEmail(email, excludeId = null) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id FROM matrix_employees
       WHERE email = :email
         AND deleted_at IS NULL
         ${excludeId ? "AND id <> :excludeId" : ""}
       LIMIT 1`,
      { email, excludeId }
    );

    return rows[0] || null;
  }

  static async findByLogon(logon, excludeId = null) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id FROM matrix_employees
       WHERE logon = :logon
         AND deleted_at IS NULL
         ${excludeId ? "AND id <> :excludeId" : ""}
       LIMIT 1`,
      { logon, excludeId }
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
       SET is_terminated = 0,
           is_suspended = 0,
           suspended_by = NULL,
           reactivated_date = NULL,
           updated_at = NOW()
       WHERE id = :id AND deleted_at IS NULL`,
      { id }
    );

    return this.findById(id, { includeDeleted: true });
  }

  static async suspend(id, { suspendedBy, reactivatedDate }) {
    const pool = getPool();

    await pool.execute(
      `UPDATE matrix_employees
       SET is_suspended = 1,
           suspended_by = :suspendedBy,
           reactivated_date = :reactivatedDate,
           updated_at = NOW()
       WHERE id = :id AND deleted_at IS NULL`,
      { id, suspendedBy, reactivatedDate }
    );

    return this.findById(id, { includeDeleted: true });
  }

  static async unsuspend(id) {
    const pool = getPool();

    await pool.execute(
      `UPDATE matrix_employees
       SET is_suspended = 0,
           suspended_by = NULL,
           reactivated_date = NULL,
           updated_at = NOW()
       WHERE id = :id AND deleted_at IS NULL`,
      { id }
    );

    return this.findById(id, { includeDeleted: true });
  }

  static async findSuspendedDueForReactivation() {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, name
       FROM matrix_employees
       WHERE is_suspended = 1
         AND deleted_at IS NULL
         AND (is_terminated = 0 OR is_terminated IS NULL)
         AND reactivated_date IS NOT NULL
         AND reactivated_date <= NOW()`
    );

    return rows;
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

  static async update(id, { name, logon, email, role }) {
    const pool = getPool();

    await pool.execute(
      `UPDATE matrix_employees
       SET name = :name,
           logon = :logon,
           email = :email,
           role = :role,
           updated_at = NOW()
       WHERE id = :id AND deleted_at IS NULL`,
      { id, name, logon, email, role }
    );

    return this.findById(id, { includeDeleted: true });
  }

  static async updateProfile(id, { name, email }) {
    const pool = getPool();

    await pool.execute(
      `UPDATE matrix_employees
       SET name = :name, email = :email, updated_at = NOW()
       WHERE id = :id AND deleted_at IS NULL`,
      { id, name, email }
    );

    return this.findByIdPublic(id);
  }

  static async updatePassword(id, passwordHash) {
    const pool = getPool();

    await pool.execute(
      `UPDATE matrix_employees
       SET password_hash = :passwordHash, updated_at = NOW()
       WHERE id = :id AND deleted_at IS NULL`,
      { id, passwordHash }
    );
  }

  static escapeLikePrefix(value) {
    return `${value || ""}`.replace(/[\\%_]/g, (character) => `\\${character}`);
  }
}

module.exports = Employee;
