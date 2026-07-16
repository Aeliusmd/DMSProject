/**
 * Bulk-seed load-test data into dms_db_backup using Faker.
 *
 * Safety: refuses to run unless DB_NAME is dms_db_backup.
 *
 * Usage:
 *   node scripts/seed-load-test-data.js
 *   node scripts/seed-load-test-data.js --orders 10000 --facilities 50 --providers 30
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { faker } = require("@faker-js/faker");
const mysql = require("mysql2/promise");

const ALLOWED_DB = "dms_db_backup";
const BATCH = 250;
const RECORD_TYPES = ["medical", "billing", "employment", "xrays", "other"];
const STAGES = ["Review Records", "Serve", "SENT"];
const US_STATES = [
  "CA", "NY", "TX", "FL", "IL", "PA", "OH", "GA", "NC", "MI",
  "NJ", "VA", "WA", "AZ", "MA", "TN", "IN", "MO", "MD", "WI",
];

function parseArgs(argv) {
  const out = { orders: 10000, facilities: 50, providers: 30 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--orders" && argv[i + 1]) out.orders = Number(argv[++i]);
    if (arg === "--facilities" && argv[i + 1]) out.facilities = Number(argv[++i]);
    if (arg === "--providers" && argv[i + 1]) out.providers = Number(argv[++i]);
  }
  return out;
}

function slugify(name, suffix) {
  const base = String(name || "facility")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${base || "facility"}-${suffix}`.slice(0, 100);
}

function sqlDate(d) {
  return d.toISOString().slice(0, 10);
}

function sqlDateTime(d) {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function assertSafeDatabase(connection) {
  const [[row]] = await connection.query("SELECT DATABASE() AS db");
  const dbName = row?.db || "";
  if (dbName !== ALLOWED_DB) {
    throw new Error(
      `Refusing to seed. Connected to "${dbName}" but only "${ALLOWED_DB}" is allowed.`
    );
  }
}

async function ensureLoadTestEmployee(connection) {
  const password = "LoadTest@123";
  const passwordHash = await bcrypt.hash(password, 10);
  const email = "loadtest@dms.local";
  const logon = "loadtest";

  const [existing] = await connection.execute(
    `SELECT id FROM matrix_employees WHERE email = ? OR logon = ? LIMIT 1`,
    [email, logon]
  );

  let employeeId;
  if (existing.length) {
    employeeId = existing[0].id;
    await connection.execute(
      `UPDATE matrix_employees
       SET password_hash = ?, role = 'Admin', is_terminated = 0, deleted_at = NULL, updated_at = NOW()
       WHERE id = ?`,
      [passwordHash, employeeId]
    );
  } else {
    const [result] = await connection.execute(
      `INSERT INTO matrix_employees
        (name, logon, email, password_hash, role, is_terminated, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'Admin', 0, NOW(), NOW())`,
      ["Load Test Admin", logon, email, passwordHash]
    );
    employeeId = result.insertId;
  }

  try {
    await connection.execute(
      `INSERT IGNORE INTO employee_settings (employee_id, created_at, updated_at)
       VALUES (?, NOW(), NOW())`,
      [employeeId]
    );
  } catch (_error) {
    // employee_settings may not exist or have different schema — ignore
  }

  return { employeeId, email, logon, password };
}

async function insertFacilities(connection, count, passwordHash) {
  const ids = [];
  for (let start = 0; start < count; start += BATCH) {
    const chunk = Math.min(BATCH, count - start);
    const placeholders = [];
    const params = [];

    for (let i = 0; i < chunk; i += 1) {
      const idx = start + i + 1;
      const name = `LT Facility ${idx} ${faker.company.name()}`.slice(0, 200);
      const suffix = `lt${idx}-${faker.string.alphanumeric(6).toLowerCase()}`;
      placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())");
      params.push(
        name,
        slugify(name, suffix),
        `lt_user_${suffix}`,
        passwordHash,
        faker.person.firstName(),
        faker.person.lastName(),
        faker.location.streetAddress().slice(0, 255),
        faker.location.zipCode("#####"),
        faker.location.city().slice(0, 100),
        faker.helpers.arrayElement(US_STATES),
        faker.helpers.fromRegExp("[0-9]{10}"),
        `lt.facility.${suffix}@example.com`
      );
    }

    const [result] = await connection.query(
      `INSERT INTO facilities
        (facility_name, slug, user_name, password_hash,
         contact_first_name, contact_last_name, address, zip_code, city, state,
         phone, email, is_active, is_auto_created, created_at, updated_at)
       VALUES ${placeholders.join(",")}`,
      params
    );

    for (let i = 0; i < chunk; i += 1) {
      ids.push(Number(result.insertId) + i);
    }
  }
  return ids;
}

async function insertProviders(connection, count) {
  const ids = [];
  for (let start = 0; start < count; start += BATCH) {
    const chunk = Math.min(BATCH, count - start);
    const placeholders = [];
    const params = [];

    for (let i = 0; i < chunk; i += 1) {
      const idx = start + i + 1;
      placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())");
      params.push(
        `LT Provider ${idx} ${faker.company.name()}`.slice(0, 255),
        faker.location.streetAddress().slice(0, 255),
        faker.location.zipCode("#####"),
        faker.location.city().slice(0, 100),
        faker.helpers.arrayElement(US_STATES),
        faker.helpers.fromRegExp("[0-9]{10}"),
        faker.helpers.fromRegExp("[0-9]{10}"),
        `lt.provider.${idx}.${faker.string.alphanumeric(4)}@example.com`
      );
    }

    const [result] = await connection.query(
      `INSERT INTO providers
        (company_name, address, zip_code, city, state, phone, fax, email,
         is_active, created_at, updated_at)
       VALUES ${placeholders.join(",")}`,
      params
    );

    for (let i = 0; i < chunk; i += 1) {
      ids.push(Number(result.insertId) + i);
    }
  }
  return ids;
}

async function insertOrders(
  connection,
  count,
  facilityIds,
  providerIds,
  employeeId
) {
  const orderIds = [];
  const runId = Date.now().toString(36).toUpperCase();

  for (let start = 0; start < count; start += BATCH) {
    const chunk = Math.min(BATCH, count - start);
    const placeholders = [];
    const params = [];
    const meta = [];

    for (let i = 0; i < chunk; i += 1) {
      const idx = start + i + 1;
      const facilityId = facilityIds[idx % facilityIds.length];
      const providerId = providerIds[idx % providerIds.length];
      const created = daysAgo(faker.number.int({ min: 0, max: 365 }));
      const orderNumber = `LT-${runId}-${String(idx).padStart(6, "0")}`;
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const company = `LT Serve ${faker.company.name()}`.slice(0, 255);

      placeholders.push(`(
        ?, ?, ?, ?, 'Active', 'WCAB',
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        'specific', ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, 'Records Clerk', ?, NULL, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        0, NULL, 0, 0, 0,
        'manual', ?, ?, NOW()
      )`);

      params.push(
        orderNumber,
        `REC-${idx}`,
        facilityId,
        providerId,
        `CASE-${faker.number.int({ min: 1000, max: 999999 })}`,
        `ORD-${idx}`,
        String(faker.number.int({ min: 1000, max: 9999 })),
        sqlDate(faker.date.birthdate({ min: 25, max: 70, mode: "age" })),
        firstName,
        faker.helpers.maybe(() => faker.person.middleName(), { probability: 0.3 }) ||
          null,
        lastName,
        faker.person.fullName().slice(0, 200),
        sqlDate(faker.date.past({ years: 5 })),
        company,
        faker.location.streetAddress().slice(0, 255),
        faker.location.zipCode("#####"),
        faker.location.city().slice(0, 100),
        faker.helpers.arrayElement(US_STATES),
        faker.helpers.fromRegExp("[0-9]{10}"),
        faker.helpers.fromRegExp("[0-9]{10}"),
        `serve.${idx}@example.com`,
        faker.person.fullName().slice(0, 150),
        faker.helpers.fromRegExp("[0-9]{10}"),
        `contact1.${idx}@example.com`,
        sqlDate(created),
        sqlDate(faker.date.soon({ days: 30, refDate: created })),
        sqlDate(created),
        sqlDate(created),
        faker.lorem.sentence().slice(0, 400),
        `Dr. ${faker.person.lastName()}`.slice(0, 200),
        faker.location.streetAddress().slice(0, 255),
        employeeId,
        sqlDateTime(created)
      );

      meta.push({ orderNumber, facilityId, providerId, created });
    }

    const [result] = await connection.query(
      `INSERT INTO orders (
        order_number, rec_number, facility_id, provider_id, status, court,
        case_number, order_ref, ssn_last_four, dob,
        applicant_first_name, applicant_middle_name, applicant_last_name, defendant,
        injury_type, injury_date,
        serve_company_name, serve_address, serve_zip, serve_city, serve_state,
        serve_phone, serve_fax, serve_email,
        contact1_name, contact1_title, contact1_phone, contact1_fax, contact1_email,
        date_served, depo_due_date, subpoena_date, date_requested,
        specific_record, specific_doctor, full_address,
        certificate_no_records, cnr_reason, cnr_memo, has_note, has_subpoena,
        creation_source, created_by, created_at, updated_at
      ) VALUES ${placeholders.join(",")}`,
      params
    );

    for (let i = 0; i < chunk; i += 1) {
      orderIds.push({
        id: Number(result.insertId) + i,
        ...meta[i],
      });
    }

    if ((start + chunk) % 1000 === 0 || start + chunk === count) {
      console.log(`  orders: ${start + chunk}/${count}`);
    }
  }

  return orderIds;
}

async function insertOrderChildren(connection, orders) {
  for (let start = 0; start < orders.length; start += BATCH) {
    const chunk = orders.slice(start, start + BATCH);

    const recordPlaceholders = [];
    const recordParams = [];
    const stagePlaceholders = [];
    const stageParams = [];
    const paymentPlaceholders = [];
    const paymentParams = [];

    for (const order of chunk) {
      const types = faker.helpers.arrayElements(
        RECORD_TYPES,
        faker.number.int({ min: 1, max: 3 })
      );
      for (const type of types) {
        recordPlaceholders.push("(?, ?, NULL, NULL, NULL, NOW(), NOW())");
        recordParams.push(order.id, type);
      }

      for (const stage of STAGES) {
        const complete =
          stage === "Review Records"
            ? faker.datatype.boolean(0.4)
            : stage === "Serve"
              ? faker.datatype.boolean(0.3)
              : faker.datatype.boolean(0.15);
        const status = stage === "SENT" && complete ? "sent" : complete ? "complete" : "pending";
        stagePlaceholders.push("(?, ?, ?, ?, NOW(), NOW())");
        stageParams.push(
          order.id,
          stage,
          status,
          complete ? sqlDateTime(order.created) : null
        );
      }

      const paid = faker.datatype.boolean(0.35) ? 15 : 0;
      paymentPlaceholders.push("(?, 'prepayment', ?, ?, ?, ?, ?, NULL, NOW(), NOW())");
      paymentParams.push(
        order.id,
        paid > 0 ? String(faker.number.int({ min: 1000, max: 999999 })) : null,
        paid > 0 ? sqlDate(order.created) : null,
        paid > 0 ? paid : null,
        Math.max(0, 15 - paid),
        paid > 0 ? 1 : 0
      );
    }

    if (recordPlaceholders.length) {
      await connection.query(
        `INSERT INTO order_records
          (order_id, record_type, storage_path, uploaded_by, uploaded_at, created_at, updated_at)
         VALUES ${recordPlaceholders.join(",")}`,
        recordParams
      );
    }

    await connection.query(
      `INSERT INTO order_workflow_stages
        (order_id, stage_name, stage_status, completed_at, created_at, updated_at)
       VALUES ${stagePlaceholders.join(",")}`,
      stageParams
    );

    await connection.query(
      `INSERT INTO order_payments
        (order_id, payment_type, check_number, payment_date, amount, due_amount, is_paid, memo, created_at, updated_at)
       VALUES ${paymentPlaceholders.join(",")}`,
      paymentParams
    );
  }
}

async function insertInvoices(connection, orders, employeeId) {
  const subset = orders.filter(() => faker.datatype.boolean(0.25));
  console.log(`  invoices: ${subset.length}`);

  for (let start = 0; start < subset.length; start += BATCH) {
    const chunk = subset.slice(start, start + BATCH);
    const placeholders = [];
    const params = [];

    for (const order of chunk) {
      const total = Number(faker.finance.amount({ min: 50, max: 800, dec: 2 }));
      const paid = faker.datatype.boolean(0.4)
        ? Number(faker.finance.amount({ min: 0, max: total, dec: 2 }))
        : 0;
      const due = Math.max(0, Number((total - paid).toFixed(2)));
      const status =
        due <= 0 ? "Paid" : paid > 0 ? "Partial" : faker.helpers.arrayElement(["Created", "Unpaid", "Pending"]);

      placeholders.push(`(
        ?, ?, ?, ?, ?, ?,
        10, 1.50, 0, 0, 15, 0,
        ?, ?, ?, 'manual', NULL, ?,
        0, NULL, NULL, NULL, NULL,
        0, 0, ?, ?, NOW(), NOW()
      )`);

      params.push(
        `LT-INV-${order.id}`,
        order.id,
        order.facilityId,
        status,
        sqlDate(order.created),
        sqlDate(order.created),
        total,
        paid,
        due,
        paid > 0 ? sqlDate(order.created) : null,
        `serve.${order.id}@example.com`,
        employeeId
      );
    }

    await connection.query(
      `INSERT INTO invoices (
        invoice_number, order_id, facility_id, status, invoice_date, sent_date,
        page_count, per_page_amount, clerical_time_hours, clerical_hourly_rate,
        shipping_handling, storage_fee,
        total_amount, amount_paid, amount_due, payment_method, payment_check_number, payment_date,
        writeoff_amount, writeoff_date, writeoff_by, writeoff_reason, notes,
        send_order_details, is_rush_order, recipient_emails, created_by, created_at, updated_at
      ) VALUES ${placeholders.join(",")}`,
      params
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!Number.isFinite(args.orders) || args.orders < 1) {
    throw new Error("Invalid --orders count");
  }

  console.log(`Seeding load-test data into ${ALLOWED_DB}…`);
  console.log(args);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    multipleStatements: false,
  });

  try {
    await assertSafeDatabase(connection);

    const employee = await ensureLoadTestEmployee(connection);
    console.log(
      `Load-test employee ready: ${employee.logon} / ${employee.password} (${employee.email})`
    );

    const passwordHash = await bcrypt.hash("LoadTestFac@1", 10);
    console.log("Inserting facilities…");
    const facilityIds = await insertFacilities(
      connection,
      args.facilities,
      passwordHash
    );
    console.log(`  facilities: ${facilityIds.length}`);

    console.log("Inserting providers…");
    const providerIds = await insertProviders(connection, args.providers);
    console.log(`  providers: ${providerIds.length}`);

    console.log("Inserting orders…");
    const orders = await insertOrders(
      connection,
      args.orders,
      facilityIds,
      providerIds,
      employee.employeeId
    );

    console.log("Inserting order records / workflow / payments…");
    await insertOrderChildren(connection, orders);

    console.log("Inserting invoices (~25%)…");
    await insertInvoices(connection, orders, employee.employeeId);

    console.log("Done.");
    console.log(`Seeded ${orders.length} LT- orders into ${ALLOWED_DB}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
