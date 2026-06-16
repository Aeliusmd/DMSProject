/**
 * Create a test employee with a bcrypt-hashed password.
 * Usage: node database/seed.js [password]
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { connectDatabase, getPool } = require("../src/config/database");

async function seed() {
  const password = process.argv[2] || "Admin@123";
  const passwordHash = await bcrypt.hash(password, 10);

  await connectDatabase();
  const pool = getPool();

  const employee = {
    name: "John Admin",
    logon: "jadmin",
    email: "admin@dms.local",
    role: "Admin",
    passwordHash,
  };

  const [existing] = await pool.execute(
    `SELECT id FROM matrix_employees WHERE email = :email LIMIT 1`,
    { email: employee.email }
  );

  if (existing.length > 0) {
    const employeeId = existing[0].id;

    await pool.execute(
      `UPDATE matrix_employees
       SET password_hash = :passwordHash, role = :role, updated_at = NOW()
       WHERE email = :email`,
      {
        email: employee.email,
        passwordHash: employee.passwordHash,
        role: employee.role,
      }
    );

    const EmployeeSettings = require("../src/models/EmployeeSettings");
    await EmployeeSettings.ensureForEmployee(employeeId);

    console.log(`Updated existing user: ${employee.email}`);
  } else {
    const [result] = await pool.execute(
      `INSERT INTO matrix_employees
        (name, logon, email, password_hash, role, is_terminated, created_at, updated_at)
       VALUES
        (:name, :logon, :email, :passwordHash, :role, 0, NOW(), NOW())`,
      {
        name: employee.name,
        logon: employee.logon,
        email: employee.email,
        passwordHash: employee.passwordHash,
        role: employee.role,
      }
    );

    const EmployeeSettings = require("../src/models/EmployeeSettings");
    await EmployeeSettings.ensureForEmployee(result.insertId);

    console.log(`Created user: ${employee.email}`);
  }

  console.log(`Logon: ${employee.logon}`);
  console.log(`Password: ${password}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
