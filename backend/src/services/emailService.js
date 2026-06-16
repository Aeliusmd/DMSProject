const nodemailer = require("nodemailer");
const config = require("../config");
const { renderTemplate } = require("../views/emails");
const logger = require("../utils/logger");

let transporter = null;

function getFromAddress() {
  const from = config.smtp.from || config.smtp.user;

  if (!from) {
    return "DMS <no-reply@localhost>";
  }

  if (from.includes("<")) {
    return from;
  }

  return `DMS <${from}>`;
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
  });

  return transporter;
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
  const text = renderTemplate("twoFactorCode", {
    name: name || "User",
    code,
    expiresInMinutes: config.twoFactor.expiresMinutes,
  });

  const mailOptions = {
    from: getFromAddress(),
    to,
    subject,
    text,
  };

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

module.exports = { sendTwoFactorCode };
