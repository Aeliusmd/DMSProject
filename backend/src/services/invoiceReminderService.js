const config = require("../config");
const { getPool } = require("../config/database");
const invoiceService = require("./invoiceService");
const logger = require("../utils/logger");

const ORDER_VISIBLE = "o.status NOT IN ('Cancelled', 'Deleted')";

async function findDueStandardInvoiceIds(reminderLevel, intervalDays) {
  const pool = getPool();
  let extraConditions = "";
  const params = { intervalDays };

  if (reminderLevel === 1) {
    extraConditions = `
      AND i.sent_date IS NOT NULL
      AND i.reminder_1_sent_at IS NULL
      AND DATEDIFF(CURDATE(), i.sent_date) >= :intervalDays`;
  } else if (reminderLevel === 2) {
    extraConditions = `
      AND i.reminder_1_sent_at IS NOT NULL
      AND i.reminder_2_sent_at IS NULL
      AND TIMESTAMPDIFF(DAY, i.reminder_1_sent_at, NOW()) >= :intervalDays`;
  } else if (reminderLevel === 3) {
    extraConditions = `
      AND i.reminder_2_sent_at IS NOT NULL
      AND i.reminder_3_sent_at IS NULL
      AND TIMESTAMPDIFF(DAY, i.reminder_2_sent_at, NOW()) >= :intervalDays`;
  } else {
    return [];
  }

  const [rows] = await pool.execute(
    `SELECT i.id
     FROM invoices i
     INNER JOIN orders o ON o.id = i.order_id
     WHERE ${ORDER_VISIBLE}
       AND i.status NOT IN ('Paid', 'Written Off')
       ${extraConditions}`,
    params
  );

  return rows.map((row) => row.id);
}

async function findDueXrayOrderIds(reminderLevel, intervalDays) {
  const pool = getPool();
  let extraConditions = "";
  const params = { intervalDays };

  if (reminderLevel === 1) {
    extraConditions = `
      AND x.sent_date IS NOT NULL
      AND x.reminder_1_sent_at IS NULL
      AND DATEDIFF(CURDATE(), x.sent_date) >= :intervalDays`;
  } else if (reminderLevel === 2) {
    extraConditions = `
      AND x.reminder_1_sent_at IS NOT NULL
      AND x.reminder_2_sent_at IS NULL
      AND TIMESTAMPDIFF(DAY, x.reminder_1_sent_at, NOW()) >= :intervalDays`;
  } else if (reminderLevel === 3) {
    extraConditions = `
      AND x.reminder_2_sent_at IS NOT NULL
      AND x.reminder_3_sent_at IS NULL
      AND TIMESTAMPDIFF(DAY, x.reminder_2_sent_at, NOW()) >= :intervalDays`;
  } else {
    return [];
  }

  const [rows] = await pool.execute(
    `SELECT x.order_id
     FROM invoice_xray_details x
     INNER JOIN orders o ON o.id = x.order_id
     WHERE ${ORDER_VISIBLE}
       ${extraConditions}`,
    params
  );

  return rows.map((row) => row.order_id);
}

async function processDueInvoiceReminders() {
  const intervalDays = config.invoiceReminder.intervalDays;
  let sentCount = 0;

  for (const reminderLevel of [1, 2, 3]) {
    const standardIds = await findDueStandardInvoiceIds(reminderLevel, intervalDays);

    for (const invoiceId of standardIds) {
      try {
        const sent = await invoiceService.sendAutomaticInvoiceReminder(
          invoiceId,
          reminderLevel,
          "standard"
        );
        if (sent) sentCount += 1;
      } catch (error) {
        logger.error("Standard invoice reminder failed", {
          invoiceId,
          reminderLevel,
          error: error.message,
        });
      }
    }

    const xrayOrderIds = await findDueXrayOrderIds(reminderLevel, intervalDays);

    for (const orderId of xrayOrderIds) {
      try {
        const sent = await invoiceService.sendAutomaticInvoiceReminder(
          orderId,
          reminderLevel,
          "xray"
        );
        if (sent) sentCount += 1;
      } catch (error) {
        logger.error("X-Ray invoice reminder failed", {
          orderId,
          reminderLevel,
          error: error.message,
        });
      }
    }
  }

  if (sentCount > 0) {
    logger.info(`Sent ${sentCount} automatic invoice reminder email(s)`);
  }

  return sentCount;
}

module.exports = {
  processDueInvoiceReminders,
};
