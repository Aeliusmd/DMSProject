const nodemailer = require("nodemailer");
const config = require("../config");
const {
  renderTwoFactorEmail,
  renderInvoiceEmail,
} = require("../views/emails");
const logger = require("../utils/logger");

let transporter = null;

function getFromAddress() {
  const configuredFrom = (config.smtp.from || config.smtp.user || "").trim();
  const smtpUser = (config.smtp.user || "").trim();

  if (!configuredFrom && !smtpUser) {
    return "DMS <no-reply@localhost>";
  }

  if (configuredFrom.includes("<")) {
    return configuredFrom;
  }

  const isGmail = String(config.smtp.host || "").includes("gmail.com");
  const fromAddress =
    isGmail && configuredFrom && !configuredFrom.endsWith("@gmail.com")
      ? smtpUser
      : configuredFrom || smtpUser;

  return `DMS Custodian <${fromAddress}>`;
}

function getReplyToAddress() {
  const configuredFrom = (config.smtp.from || "").trim();
  const smtpUser = (config.smtp.user || "").trim();

  if (!configuredFrom || configuredFrom === smtpUser) {
    return undefined;
  }

  if (configuredFrom.includes("<")) {
    return configuredFrom;
  }

  return configuredFrom;
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (!config.smtp.user || !config.smtp.pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
    ...(config.smtp.host.includes("gmail.com")
      ? { tls: { rejectUnauthorized: true } }
      : {}),
  });

  return transporter;
}

function buildMailOptions({ to, subject, text, html }) {
  return {
    from: getFromAddress(),
    ...(getReplyToAddress() ? { replyTo: getReplyToAddress() } : {}),
    to,
    subject,
    text,
    html,
  };
}

function logDevCode(to, code) {
  logger.warn("[DEV] 2FA verification code", {
    to,
    code,
    hint: "Set a valid Gmail App Password in .env to send real emails",
  });
}

async function sendTwoFactorCode({ to, name, code }) {
  if (config.twoFactor.devLogCode) {
    logDevCode(to, code);
    return { delivered: false, devLogged: true };
  }

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    if (config.nodeEnv === "development") {
      logDevCode(to, code);
      return { delivered: false, devLogged: true };
    }

    throw new Error("SMTP is not configured");
  }

  const subject = "Your DMS verification code";
  const { text, html } = renderTwoFactorEmail({
    name: name || "User",
    code,
    expiresInMinutes: config.twoFactor.expiresMinutes,
  });

  const mailOptions = buildMailOptions({ to, subject, text, html });

  try {
    await mailTransporter.sendMail(mailOptions);
    logger.info("2FA email sent", { to });
    return { delivered: true, devLogged: false };
  } catch (error) {
    logger.error("Failed to send 2FA email", { to, error: error.message });

    if (config.nodeEnv === "development") {
      logDevCode(to, code);
      return { delivered: false, devLogged: true };
    }

    throw error;
  }
}

async function sendInvoiceEmail({
  to,
  companyName,
  caseNo,
  applicant,
  invoiceDate,
  sentDate,
  invoiced,
  paid,
  due,
  isResend = false,
  sendOrderDetails = false,
  isRushOrder = false,
  rushLevel = null,
  orderDetailsText = "",
}) {
  const baseSubject = isResend
    ? `Resent Invoice - Case ${caseNo}`
    : `Invoice - Case ${caseNo}`;
  const subject = isRushOrder ? `RUSH - ${baseSubject}` : baseSubject;

  const templateData = {
    companyName,
    caseNo,
    applicant,
    invoiceDate,
    sentDate,
    invoiced,
    paid,
    due,
    isResend,
    sendOrderDetails,
    isRushOrder,
    rushLevel,
    orderDetailsText,
  };

  const { text, html } = renderInvoiceEmail(templateData);

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    if (config.nodeEnv === "development") {
      logger.warn("[DEV] Invoice email", { to, subject, text });
      return { delivered: false, devLogged: true };
    }

    throw new Error("SMTP is not configured");
  }

  const mailOptions = buildMailOptions({ to, subject, text, html });

  try {
    await mailTransporter.sendMail(mailOptions);
    logger.info("Invoice email sent", { to, caseNo, isResend });
    return { delivered: true, devLogged: false };
  } catch (error) {
    logger.error("Failed to send invoice email", { to, error: error.message });

    if (config.nodeEnv === "development") {
      logger.warn("[DEV] Invoice email fallback", { to, subject, text });
      return { delivered: false, devLogged: true };
    }

    throw error;
  }
}

module.exports = { sendTwoFactorCode, sendInvoiceEmail };
