const invoiceReminderService = require("../services/invoiceReminderService");
const logger = require("../utils/logger");
const config = require("../config");

function startInvoiceReminderJob() {
  const intervalMs = config.invoiceReminder.checkIntervalMs;

  const run = async () => {
    try {
      await invoiceReminderService.processDueInvoiceReminders();
    } catch (error) {
      logger.error("Invoice reminder job failed", { error: error.message });
    }
  };

  run();
  setInterval(run, intervalMs).unref();
}

module.exports = { startInvoiceReminderJob };
