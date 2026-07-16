/**
 * Backfill stripe_online_payments rows for company portal wallet invoice payments
 * that were skipped because the $15 order-fee prepayment already used
 * payment_method_type=wallet + invoice_type=regular.
 *
 * Usage: node scripts/backfill-wallet-invoice-online-payments.js
 */

require("dotenv").config();
const { connectDatabase, getPool } = require("../src/config/database");

async function main() {
  await connectDatabase();
  const stripePaymentService = require("../src/services/stripePaymentService");
  const result =
    await stripePaymentService.backfillMissingWalletInvoiceOnlinePayments({
      limit: 200,
    });
  console.log("Wallet invoice online payment backfill:", result);
  await getPool().end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
