/**
 * One-time cleanup for company portal orders whose facility was auto-created in
 * the internal `facilities` table before the "placeholder facility" fix.
 *
 * For every company portal order that still has a PENDING new-facility request
 * (facility not in our system) but whose synced internal order points at an
 * auto-created facility, this script:
 *   1. Re-points the internal order to the reserved placeholder facility.
 *   2. Deletes the now-orphaned auto-created facility (only when nothing else
 *      references it), freeing its name/slug so internal staff can add it.
 *
 * Safe to run multiple times.
 * Run: node scripts/fix-company-portal-auto-created-facilities.js
 */

require("dotenv").config();

const { connectDatabase, getPool } = require("../src/config/database");
const companyPortalInternalSyncService = require("../src/services/companyPortalInternalSyncService");

async function countReferences(pool, facilityId) {
  const [[orders]] = await pool.query(
    `SELECT COUNT(*) AS c FROM orders WHERE facility_id = ?`,
    [facilityId]
  );
  const [[invoices]] = await pool.query(
    `SELECT COUNT(*) AS c FROM invoices WHERE facility_id = ?`,
    [facilityId]
  );
  const [[managers]] = await pool.query(
    `SELECT COUNT(*) AS c FROM office_managers WHERE facility_id = ?`,
    [facilityId]
  );
  const [[doctors]] = await pool.query(
    `SELECT COUNT(*) AS c FROM facility_doctors WHERE facility_id = ?`,
    [facilityId]
  );
  return orders.c + invoices.c + managers.c + doctors.c;
}

async function run() {
  await connectDatabase();
  const pool = getPool();

  const placeholderFacilityId =
    await companyPortalInternalSyncService.resolvePlaceholderFacilityId();
  if (!placeholderFacilityId) {
    console.log("Could not resolve placeholder facility. Aborting.");
    await pool.end();
    return;
  }
  console.log(`Placeholder facility id: ${placeholderFacilityId}`);

  // Pending new-facility requests linked to a portal order that has an internal order.
  const [rows] = await pool.query(
    `SELECT nf.id AS new_facility_id,
            cpo.id AS portal_order_id,
            cpo.internal_order_id,
            o.facility_id AS current_facility_id,
            f.is_auto_created,
            f.facility_name
     FROM company_portal_new_facility nf
     INNER JOIN company_portal_orders cpo ON cpo.id = nf.portal_order_id
     INNER JOIN orders o ON o.id = cpo.internal_order_id
     LEFT JOIN facilities f ON f.id = o.facility_id
     WHERE nf.status = 'pending'
       AND cpo.internal_order_id IS NOT NULL`
  );

  let repointed = 0;
  let deleted = 0;

  for (const row of rows) {
    if (Number(row.current_facility_id) === Number(placeholderFacilityId)) {
      continue;
    }
    if (!Number(row.is_auto_created)) {
      // Facility was a real one; leave it alone.
      continue;
    }

    const autoFacilityId = Number(row.current_facility_id);

    await pool.query(
      `UPDATE orders SET facility_id = ?, updated_at = NOW() WHERE id = ?`,
      [placeholderFacilityId, row.internal_order_id]
    );
    repointed += 1;
    console.log(
      `Re-pointed internal order ${row.internal_order_id} (portal ${row.portal_order_id}) to placeholder`
    );

    const refs = await countReferences(pool, autoFacilityId);
    if (refs === 0) {
      await pool.query(`DELETE FROM facilities WHERE id = ?`, [autoFacilityId]);
      deleted += 1;
      console.log(
        `Deleted orphaned auto-created facility ${autoFacilityId} ("${row.facility_name}")`
      );
    } else {
      console.log(
        `Kept facility ${autoFacilityId} ("${row.facility_name}") — still referenced by ${refs} record(s)`
      );
    }
  }

  await pool.end();
  console.log(
    `Cleanup complete. Re-pointed ${repointed} order(s), deleted ${deleted} facility(ies).`
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
