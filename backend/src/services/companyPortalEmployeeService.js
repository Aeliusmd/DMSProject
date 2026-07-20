const bcrypt = require("bcryptjs");
const ApiError = require("../utils/ApiError");
const CompanyPortalEmployee = require("../models/CompanyPortalEmployee");
const { sendCompanyEmployeeCredentials } = require("./emailService");

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function formatEmployee(row) {
  if (!row) return null;

  return {
    id: row.id,
    companyUserId: row.company_user_id,
    name: row.name,
    email: row.email,
    walletBalance: Number(row.wallet_balance || 0),
    isActive: Boolean(row.is_active),
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function validatePassword(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, "Password must be at least 8 characters", [
      { field: "password", message: "Password must be at least 8 characters" },
    ]);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ApiError(400, "Password is too long", [
      {
        field: "password",
        message: `Password must be ${MAX_PASSWORD_LENGTH} characters or less`,
      },
    ]);
  }

  if (/\s/.test(password)) {
    throw new ApiError(400, "Password cannot contain spaces", [
      { field: "password", message: "Password cannot contain spaces" },
    ]);
  }
}

async function listEmployees(companyUserId, { search = "" } = {}) {
  const rows = await CompanyPortalEmployee.listForCompany(companyUserId, {
    search,
  });
  return rows.map(formatEmployee);
}

async function listEmployeesPaginated(
  companyUserId,
  { search = "", cursor = null, pageSize = 10 } = {}
) {
  const result = await CompanyPortalEmployee.listForCompanyKeyset(
    companyUserId,
    { search, cursor, pageSize }
  );

  return {
    employees: result.rows.map(formatEmployee),
    pagination: {
      type: "keyset",
      pageSize: result.pageSize,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    },
  };
}

async function createEmployee(companyUserId, { name, email, password }) {
  const cleanedName = `${name || ""}`.trim();
  const cleanedEmail = `${email || ""}`.trim().toLowerCase();

  if (!cleanedName) {
    throw new ApiError(400, "Employee name is required", [
      { field: "name", message: "Employee name is required" },
    ]);
  }

  if (!cleanedEmail) {
    throw new ApiError(400, "Employee email is required", [
      { field: "email", message: "Employee email is required" },
    ]);
  }

  validatePassword(password);

  const existing = await CompanyPortalEmployee.findByEmail(cleanedEmail);
  if (existing && Number(existing.company_user_id) === Number(companyUserId)) {
    throw new ApiError(409, "An employee with this email already exists", [
      { field: "email", message: "An employee with this email already exists" },
    ]);
  }

  if (existing) {
    throw new ApiError(409, "This email is already in use", [
      { field: "email", message: "This email is already in use" },
    ]);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const employee = await CompanyPortalEmployee.create({
    companyUserId,
    name: cleanedName,
    email: cleanedEmail,
    passwordHash,
  });

  try {
    await sendCompanyEmployeeCredentials({
      to: cleanedEmail,
      name: cleanedName,
      email: cleanedEmail,
      password,
    });
  } catch (error) {
    // Employee is created even if email fails; admin can resend manually later.
    console.warn(
      "[company-portal] Failed to email employee credentials:",
      error.message || error
    );
  }

  return {
    employee: formatEmployee(employee),
    message: "Employee account created successfully",
  };
}

module.exports = {
  listEmployees,
  listEmployeesPaginated,
  createEmployee,
  formatEmployee,
};
