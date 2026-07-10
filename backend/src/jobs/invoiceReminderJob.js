const invoiceReminderService = require("../services/invoiceReminderService");
const { runSafely } = require("../utils/asyncHandler");

function startInvoiceReminderJob() {
  const intervalMs = require("../config").invoiceReminder.checkIntervalMs;
  const run = runSafely(
    "Invoice reminder job failed",
    () => invoiceReminderService.processDueInvoiceReminders()
  );

  run();
  setInterval(run, intervalMs).unref();
}

module.exports = { startInvoiceReminderJob };
