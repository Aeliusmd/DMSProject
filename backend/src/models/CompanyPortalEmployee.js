const { getPool } = require("../config/database");

function encodeNameCursor(name, id) {
  if (!name || !id) return null;
  try {
    return Buffer.from(
      JSON.stringify({ name: String(name), id: Number(id) }),
      "utf8"
    ).toString("base64url");
  } catch {
    return null;
  }
}

function decodeNameCursor(rawCursor) {
  if (rawCursor == null || rawCursor === "") return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(String(rawCursor), "base64url").toString("utf8")
    );
    const name = `${parsed?.name || ""}`;
    const id = Number(parsed?.id);
    if (!name || !Number.isFinite(id) || id <= 0) return null;
    return { name, id };
  } catch {
    return null;
  }
}

class CompanyPortalEmployee {
  static async findByEmail(email, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT e.*, u.company_name
       FROM company_portal_employees e
       INNER JOIN company_portal_users u ON u.id = e.company_user_id
       WHERE e.email = :email
         AND e.deleted_at IS NULL
         AND u.deleted_at IS NULL
       LIMIT 1`,
      { email: `${email || ""}`.trim().toLowerCase() }
    );
    return rows[0] || null;
  }

  static async findByIdForCompany(id, companyUserId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT *
       FROM company_portal_employees
       WHERE id = :id
         AND company_user_id = :companyUserId
         AND deleted_at IS NULL
       LIMIT 1`,
      { id, companyUserId }
    );
    return rows[0] || null;
  }

  static async listForCompany(
    companyUserId,
    { search = "", limit = 100 } = {},
    connection = null
  ) {
    const db = connection || getPool();
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const term = `${search || ""}`.trim().toLowerCase();
    const params = { companyUserId };
    let searchClause = "";

    if (term) {
      searchClause = `AND (
        LOWER(name) LIKE :search
        OR LOWER(email) LIKE :search
      )`;
      params.search = `%${term}%`;
    }

    const [rows] = await db.execute(
      `SELECT id, company_user_id, name, email, wallet_balance, is_active,
              last_login_at, created_at, updated_at
       FROM company_portal_employees
       WHERE company_user_id = :companyUserId
         AND deleted_at IS NULL
         ${searchClause}
       ORDER BY name ASC, id ASC
       LIMIT ${safeLimit}`,
      params
    );
    return rows;
  }

  static async listForCompanyKeyset(
    companyUserId,
    { search = "", cursor = null, pageSize = 10 } = {},
    connection = null
  ) {
    const db = connection || getPool();
    const safePageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 50);
    const queryLimit = safePageSize + 1;
    const term = `${search || ""}`.trim().toLowerCase();
    const params = { companyUserId };
    let searchClause = "";
    let cursorCondition = "";

    if (term) {
      searchClause = `AND (
        LOWER(name) LIKE :search
        OR LOWER(email) LIKE :search
      )`;
      params.search = `%${term}%`;
    }

    const decoded = decodeNameCursor(cursor);
    if (decoded) {
      cursorCondition = `AND (
        name > :cursorName
        OR (
          name = :cursorName
          AND id > :cursorId
        )
      )`;
      params.cursorName = decoded.name;
      params.cursorId = decoded.id;
    }

    const [rows] = await db.execute(
      `SELECT id, company_user_id, name, email, wallet_balance, is_active,
              last_login_at, created_at, updated_at
       FROM company_portal_employees
       WHERE company_user_id = :companyUserId
         AND deleted_at IS NULL
         ${searchClause}
         ${cursorCondition}
       ORDER BY name ASC, id ASC
       LIMIT ${queryLimit}`,
      params
    );

    const hasMore = rows.length > safePageSize;
    const pageRows = hasMore ? rows.slice(0, safePageSize) : rows;
    const lastRow = pageRows[pageRows.length - 1] || null;

    return {
      rows: pageRows,
      pageSize: safePageSize,
      hasMore,
      nextCursor:
        hasMore && lastRow ? encodeNameCursor(lastRow.name, lastRow.id) : null,
    };
  }

  static async create(data, connection = null) {
    const db = connection || getPool();
    const [result] = await db.execute(
      `INSERT INTO company_portal_employees
        (company_user_id, name, email, password_hash, wallet_balance, is_active, created_at, updated_at)
       VALUES
        (:companyUserId, :name, :email, :passwordHash, 0, 1, NOW(), NOW())`,
      {
        companyUserId: data.companyUserId,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
      }
    );
    return this.findByIdForCompany(result.insertId, data.companyUserId, connection);
  }

  static async setActive(id, companyUserId, isActive, connection = null) {
    const db = connection || getPool();
    const [result] = await db.execute(
      `UPDATE company_portal_employees
       SET is_active = :isActive,
           updated_at = NOW()
       WHERE id = :id
         AND company_user_id = :companyUserId
         AND deleted_at IS NULL`,
      {
        id,
        companyUserId,
        isActive: isActive ? 1 : 0,
      }
    );

    if (!result.affectedRows) {
      return null;
    }

    return this.findByIdForCompany(id, companyUserId, connection);
  }

  static async updateLastLogin(id, connection = null) {
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_employees
       SET last_login_at = NOW(), updated_at = NOW()
       WHERE id = :id`,
      { id }
    );
  }

  static async adjustWalletBalance(id, delta, connection = null) {
    const db = connection || getPool();
    const numericDelta = Number(Number(delta || 0).toFixed(2));

    if (numericDelta < 0) {
      const amount = Math.abs(numericDelta);
      const [result] = await db.execute(
        `UPDATE company_portal_employees
         SET wallet_balance = wallet_balance - :amount,
             updated_at = NOW()
         WHERE id = :id
           AND deleted_at IS NULL
           AND wallet_balance >= :amount`,
        { id, amount }
      );

      if (!result.affectedRows) {
        const ApiError = require("../utils/ApiError");
        throw new ApiError(400, "Insufficient employee wallet balance", [
          {
            field: "paymentMethod",
            message: "Employee wallet balance is too low for this order",
          },
        ]);
      }
    } else if (numericDelta > 0) {
      await db.execute(
        `UPDATE company_portal_employees
         SET wallet_balance = wallet_balance + :delta,
             updated_at = NOW()
         WHERE id = :id
           AND deleted_at IS NULL`,
        { id, delta: numericDelta }
      );
    }

    const [rows] = await db.execute(
      `SELECT wallet_balance
       FROM company_portal_employees
       WHERE id = :id
       LIMIT 1`,
      { id }
    );
    return Number(rows[0]?.wallet_balance || 0);
  }

  static async getAllocatedTotal(companyUserId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT COALESCE(SUM(wallet_balance), 0) AS allocated_total
       FROM company_portal_employees
       WHERE company_user_id = :companyUserId
         AND deleted_at IS NULL`,
      { companyUserId }
    );
    return Number(rows[0]?.allocated_total || 0);
  }
}

module.exports = CompanyPortalEmployee;
