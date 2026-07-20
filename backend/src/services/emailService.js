const nodemailer = require("nodemailer");
const config = require("../config");
const ApiError = require("../utils/ApiError");
const { rethrowServiceError } = require("../utils/serviceErrorUtils");
const {
  renderTwoFactorEmail,
  renderInvoiceEmail,
} = require("../views/emails");
const logger = require("../utils/logger");
const { escapeHtml } = require("../utils/sanitize");

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

  const isGmail = String(config.smtp.host || "").includes("gmail.com");
  const port = Number(config.smtp.port) || 587;
  const secure = Boolean(config.smtp.secure) || port === 465;

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port,
    secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
    connectionTimeout: config.smtp.connectionTimeout,
    greetingTimeout: config.smtp.greetingTimeout,
    socketTimeout: config.smtp.socketTimeout,
    pool: false,
    tls: {
      minVersion: "TLSv1.2",
      // Gmail / corporate SMTP often break on strict MITM inspection locally.
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
    },
    ...(isGmail || port === 587
      ? {
          requireTLS: !secure,
        }
      : {}),
  });

  return transporter;
}

function resetTransporter() {
  transporter = null;
}

function throwEmailDeliveryError(error) {
  const detail = error?.message || "Unknown SMTP error";
  throw new ApiError(
    503,
    `Email delivery failed: ${detail}. Check SMTP settings and network access to ${config.smtp.host}:${config.smtp.port}.`
  );
}

async function sendMailWithRetry(mailOptions, { attempts = 2 } = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const mailTransporter = getTransporter();
    if (!mailTransporter) {
      return null;
    }

    try {
      await mailTransporter.sendMail(mailOptions);
      return { delivered: true };
    } catch (error) {
      lastError = error;
      logger.warn("SMTP send attempt failed", {
        attempt,
        to: mailOptions?.to,
        error: error.message,
      });
      resetTransporter();
    }
  }

  throw lastError;
}

function buildMailOptions({ to, subject, text, html, attachments }) {
  return {
    from: getFromAddress(),
    ...(getReplyToAddress() ? { replyTo: getReplyToAddress() } : {}),
    to,
    subject,
    text,
    html,
    ...(attachments?.length ? { attachments } : {}),
  };
}

function logDevCode(to, code) {
  logger.warn("[DEV] 2FA verification code", {
    to,
    code,
    hint: "Set a valid Gmail App Password in .env to send real emails",
  });
}

async function sendTwoFactorCode({ to, name, code, subtitle }) {
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

    throw new ApiError(503, "Email service is not configured");
  }

  const subject = "Your DMS verification code";
  const { text, html } = renderTwoFactorEmail({
    name: name || "User",
    code,
    expiresInMinutes: config.twoFactor.expiresMinutes,
    subtitle: subtitle || "Legal Practice Management Portal",
  });

  const mailOptions = buildMailOptions({ to, subject, text, html });

  try {
    await sendMailWithRetry(mailOptions);
    logger.info("2FA email sent", { to });
    return { delivered: true, devLogged: false };
  } catch (error) {
    logger.error("Failed to send 2FA email", { to, error: error.message });

    if (config.nodeEnv === "development") {
      logDevCode(to, code);
      return { delivered: false, devLogged: true };
    }

    rethrowServiceError(error);
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
  reminderLevel = null,
  sendOrderDetails = false,
  isRushOrder = false,
  rushLevel = null,
  orderDetailsText = "",
  attachments = [],
  subjectOverride = null,
  paymentUrl = null,
}) {
  const reminderNumber = Number(reminderLevel) || 0;
  const isReminder = reminderNumber > 0;
  const baseSubject = subjectOverride
    ? subjectOverride
    : isReminder
      ? `Reminder ${reminderNumber} - Invoice - Case ${caseNo}`
      : isResend
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
    reminderLevel: isReminder ? reminderNumber : null,
    sendOrderDetails,
    isRushOrder,
    rushLevel,
    orderDetailsText,
    paymentUrl,
  };

  const { text, html } = renderInvoiceEmail(templateData);
  const attachmentNote =
    attachments.length > 0
      ? "\n\nThe invoice PDF is attached to this email."
      : "";
  const emailText = `${text}${attachmentNote}`;
  const emailHtml =
    attachments.length > 0
      ? `${html}<p style="margin-top:16px;">The invoice PDF is attached to this email.</p>`
      : html;

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    if (config.nodeEnv === "development") {
      logger.warn("[DEV] Invoice email", {
        to,
        subject,
        text: emailText,
        attachments: attachments.map((file) => file.filename),
      });
      return { delivered: false, devLogged: true };
    }

    throw new ApiError(503, "Email service is not configured");
  }

  const mailOptions = buildMailOptions({
    to,
    subject,
    text: emailText,
    html: emailHtml,
    attachments,
  });

  try {
    await mailTransporter.sendMail(mailOptions);
    logger.info("Invoice email sent", {
      to,
      caseNo,
      isResend,
      attachments: attachments.length,
    });
    return { delivered: true, devLogged: false };
  } catch (error) {
    logger.error("Failed to send invoice email", { to, error: error.message });

        throwEmailDeliveryError(error);
  }
}

function plainTextToHtml(text = "") {
  const lines = String(text).split("\n");

  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.5;">
      ${lines
        .map((line) => `<p>${line ? escapeHtml(line) : "&nbsp;"}</p>`)
        .join("")}
    </div>
  `;
}

function escapeHtmlMultiline(value = "") {
  return escapeHtml(value).replace(/\r\n/g, "\n").replace(/\n/g, "<br />");
}

function emailDetailLine(label, value) {
  if (!value) return "";
  return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

function formatRecordTypesPhrase(labels = []) {
  const cleaned = labels.filter(Boolean);
  if (!cleaned.length) return "records";

  const lower = cleaned.map((label) => label.toLowerCase());
  if (lower.length === 1) return lower[0];
  if (lower.length === 2) return `${lower[0]} and ${lower[1]}`;
  return `${lower.slice(0, -1).join(", ")}, and ${lower[lower.length - 1]}`;
}

function buildDefaultOrderCompletedMailText({
  orderNumber,
  applicant,
  providerName,
  recordLabels = [],
  downloadUrl = "",
  expiresLabel = "",
}) {
  const recordsPhrase = formatRecordTypesPhrase(recordLabels);
  const sentenceStart =
    recordsPhrase.charAt(0).toUpperCase() + recordsPhrase.slice(1);

  const lines = [
    "Hello,",
    "",
    `${sentenceStart} for order ${orderNumber} are ready.`,
  ];

  if (applicant) {
    lines.push(`Applicant: ${applicant}`);
  }

  if (providerName) {
    lines.push(`Provider: ${providerName}`);
  }

  if (downloadUrl) {
    lines.push(
      "",
      "Use the secure link below to download the records:",
      downloadUrl
    );

    if (expiresLabel) {
      lines.push(`This link expires on ${expiresLabel} (7 days from send date).`);
    }
  }

  lines.push(
    "",
    "Please contact us if you have any questions.",
    "",
    "DMS Custodian"
  );

  return lines.join("\n");
}

function formatDownloadExpiryLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function sendOrderCompletedMail({
  to,
  orderNumber,
  applicant,
  providerName,
  recordLabels = [],
  downloadUrl = "",
  expiresAt = null,
  message = "",
}) {
  const expiresLabel = expiresAt ? formatDownloadExpiryLabel(expiresAt) : "";
  const subject = `Records Ready — Order ${orderNumber}`;
  const text =
    message?.trim() ||
    buildDefaultOrderCompletedMailText({
      orderNumber,
      applicant,
      providerName,
      recordLabels,
      downloadUrl,
      expiresLabel,
    });

  const downloadHtml = downloadUrl
    ? `<p style="margin:16px 0;">
        <a href="${escapeHtml(downloadUrl)}" style="color:#007F96;font-weight:600;">
          Download Records
        </a>
      </p>
      ${
        expiresLabel
          ? `<p style="margin:0 0 16px;color:#64748B;font-size:13px;">
              This link expires on <strong>${escapeHtml(expiresLabel)}</strong> (7 days from send date).
            </p>`
          : ""
      }`
    : "";

  const html = `${plainTextToHtml(text)}${downloadHtml}`;

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    if (config.nodeEnv === "development") {
      logger.warn("[DEV] Order completed mail", {
        to,
        subject,
        text,
        downloadUrl,
      });
      return { delivered: false, devLogged: true };
    }

    throw new ApiError(503, "Email service is not configured");
  }

  const mailOptions = buildMailOptions({ to, subject, text, html });

  try {
    await mailTransporter.sendMail(mailOptions);
    logger.info("Order completed mail sent", {
      to,
      orderNumber,
      downloadUrl,
    });
    return { delivered: true, devLogged: false };
  } catch (error) {
    logger.error("Failed to send order completed mail", {
      to,
      error: error.message,
    });

        throwEmailDeliveryError(error);
  }
}

async function sendCopyServiceLetterEmail({
  to,
  orderNumber,
  applicantName,
  facilityName,
  sendDate,
  expiresDate,
  pdfBuffer,
}) {
  const subject = `Copy Service Letter - Order ${orderNumber}`;
  const sentLabel = formatCopyLetterDate(sendDate);
  const expiresLabel = formatCopyLetterDate(expiresDate);

  const text = [
    "Dear Copy Service,",
    "",
    `Attached is the copy service letter for order ${orderNumber}.`,
    applicantName ? `Applicant: ${applicantName}` : "",
    facilityName ? `Facility: ${facilityName}` : "",
    "",
    `Sent on ${sentLabel}.`,
    `This letter expires on ${expiresLabel} (7 days from send date).`,
    "",
    "DMS Custodian",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.5;">
      <p>Dear Copy Service,</p>
      <p>Attached is the copy service letter for order <strong>${escapeHtml(orderNumber)}</strong>.</p>
      ${emailDetailLine("Applicant", applicantName)}
      ${emailDetailLine("Facility", facilityName)}
      <p>Sent on <strong>${escapeHtml(sentLabel)}</strong>.<br />
      This letter expires on <strong>${escapeHtml(expiresLabel)}</strong> (7 days from send date).</p>
      <p style="margin-top:24px;color:#64748B;">DMS Custodian</p>
    </div>
  `;

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    if (config.nodeEnv === "development") {
      logger.warn("[DEV] Copy service letter email", { to, subject, text });
      return { delivered: false, devLogged: true };
    }

    throw new ApiError(503, "Email service is not configured");
  }

  const mailOptions = buildMailOptions({
    to,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `copy-service-letter-${orderNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  try {
    await mailTransporter.sendMail(mailOptions);
    logger.info("Copy service letter email sent", { to, orderNumber });
    return { delivered: true, devLogged: false };
  } catch (error) {
    logger.error("Failed to send copy service letter email", {
      to,
      error: error.message,
    });

        throwEmailDeliveryError(error);
  }
}

function formatCopyLetterDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function sendCnrRecordEmail({
  to,
  orderNumber,
  applicantName,
  documentDate,
  cnrReason = "",
  documentTitle = "Certificate of No Records",
  pdfBuffer,
}) {
  const subject = `${documentTitle} - Order ${orderNumber}`;
  const sentLabel = formatCopyLetterDate(documentDate);
  const reasonBlock = cnrReason
    ? [`Reason: ${cnrReason}`, ""]
  : [];

  const text = [
    "Dear Copy Service,",
    "",
    `Attached is the ${documentTitle.toLowerCase()} for order ${orderNumber}.`,
    applicantName ? `Applicant: ${applicantName}` : "",
    ...reasonBlock,
    `Document date: ${sentLabel}.`,
    "",
    "DMS Custodian",
  ]
    .filter(Boolean)
    .join("\n");

  const safeDocumentTitle = escapeHtml(String(documentTitle).toLowerCase());

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.5;">
      <p>Dear Copy Service,</p>
      <p>Attached is the ${safeDocumentTitle} for order <strong>${escapeHtml(orderNumber)}</strong>.</p>
      ${emailDetailLine("Applicant", applicantName)}
      ${
        cnrReason
          ? `<p><strong>Reason:</strong> ${escapeHtmlMultiline(cnrReason)}</p>`
          : ""
      }
      <p>Document date: <strong>${escapeHtml(sentLabel)}</strong>.</p>
      <p style="margin-top:24px;color:#64748B;">DMS Custodian</p>
    </div>
  `;

  const attachmentName = documentTitle.toLowerCase().includes("memo")
    ? `cnr-memo-${orderNumber}.pdf`
    : `cnr-letter-${orderNumber}.pdf`;

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    if (config.nodeEnv === "development") {
      logger.warn("[DEV] CNR record email", { to, subject, text });
      return { delivered: false, devLogged: true };
    }

    throw new ApiError(503, "Email service is not configured");
  }

  const mailOptions = buildMailOptions({
    to,
    subject,
    text,
    html,
    attachments: [
      {
        filename: attachmentName,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  try {
    await mailTransporter.sendMail(mailOptions);
    logger.info("CNR record email sent", { to, orderNumber });
    return { delivered: true, devLogged: false };
  } catch (error) {
    logger.error("Failed to send CNR record email", {
      to,
      error: error.message,
    });

        throwEmailDeliveryError(error);
  }
}

async function sendCnrMemoEmail({
  to,
  orderNumber,
  applicantName,
  memoDate,
  pdfBuffer,
}) {
  const subject = `CNR Memo - Order ${orderNumber}`;
  const sentLabel = formatCopyLetterDate(memoDate);

  const text = [
    "Dear Copy Service,",
    "",
    `Attached is the Certificate of No Records memo for order ${orderNumber}.`,
    applicantName ? `Applicant: ${applicantName}` : "",
    "",
    `Memo date: ${sentLabel}.`,
    "",
    "DMS Custodian",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.5;">
      <p>Dear Copy Service,</p>
      <p>Attached is the Certificate of No Records memo for order <strong>${escapeHtml(orderNumber)}</strong>.</p>
      ${emailDetailLine("Applicant", applicantName)}
      <p>Memo date: <strong>${escapeHtml(sentLabel)}</strong>.</p>
      <p style="margin-top:24px;color:#64748B;">DMS Custodian</p>
    </div>
  `;

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    if (config.nodeEnv === "development") {
      logger.warn("[DEV] CNR memo email", { to, subject, text });
      return { delivered: false, devLogged: true };
    }

    throw new ApiError(503, "Email service is not configured");
  }

  const mailOptions = buildMailOptions({
    to,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `cnr-memo-${orderNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  try {
    await mailTransporter.sendMail(mailOptions);
    logger.info("CNR memo email sent", { to, orderNumber });
    return { delivered: true, devLogged: false };
  } catch (error) {
    logger.error("Failed to send CNR memo email", {
      to,
      error: error.message,
    });

        throwEmailDeliveryError(error);
  }
}

async function sendCertificateOfRecordsEmail({
  to,
  orderNumber,
  applicantName,
  documentDate,
  pdfBuffer,
}) {
  const documentTitle = "Certificate of Records";
  const subject = `${documentTitle} - Order ${orderNumber}`;
  const sentLabel = formatCopyLetterDate(documentDate);

  const text = [
    "Dear Copy Service,",
    "",
    `Attached is the certificate of records for order ${orderNumber}.`,
    applicantName ? `Applicant: ${applicantName}` : "",
    `Document date: ${sentLabel}.`,
    "",
    "DMS Custodian",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.5;">
      <p>Dear Copy Service,</p>
      <p>Attached is the certificate of records for order <strong>${escapeHtml(orderNumber)}</strong>.</p>
      ${emailDetailLine("Applicant", applicantName)}
      <p>Document date: <strong>${escapeHtml(sentLabel)}</strong>.</p>
      <p style="margin-top:24px;color:#64748B;">DMS Custodian</p>
    </div>
  `;

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    if (config.nodeEnv === "development") {
      logger.warn("[DEV] Certificate of records email", { to, subject, text });
      return { delivered: false, devLogged: true };
    }

    throw new ApiError(503, "Email service is not configured");
  }

  const mailOptions = buildMailOptions({
    to,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `certificate-of-records-${orderNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  try {
    await mailTransporter.sendMail(mailOptions);
    logger.info("Certificate of records email sent", { to, orderNumber });
    return { delivered: true, devLogged: false };
  } catch (error) {
    logger.error("Failed to send certificate of records email", {
      to,
      error: error.message,
    });

        throwEmailDeliveryError(error);
  }
}

async function sendPaymentResultEmail({
  to,
  outcome = "success",
  companyName,
  orderNumber,
  invoiceNumber,
  amount,
  failureMessage = "",
  receiptUrl = "",
}) {
  if (!to) {
    return { delivered: false, devLogged: false };
  }

  const {
    renderPaymentResultText,
    renderPaymentResultHtml,
  } = require("../views/emails/paymentResultEmail");

  const templateData = {
    outcome,
    companyName,
    orderNumber,
    invoiceNumber,
    amount,
    failureMessage,
    receiptUrl,
  };

  const text = renderPaymentResultText(templateData);
  const html = renderPaymentResultHtml(templateData);
  const isSuccess = outcome === "success";
  const subject = isSuccess
    ? `Payment Received - Order ${orderNumber || ""}`
    : `Payment Failed - Order ${orderNumber || ""}`;

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    if (config.nodeEnv === "development") {
      logger.warn("[DEV] Payment result email", { to, subject, text });
      return { delivered: false, devLogged: true };
    }

    throw new ApiError(503, "Email service is not configured");
  }

  const mailOptions = buildMailOptions({
    to,
    subject,
    text,
    html,
  });

  try {
    await mailTransporter.sendMail(mailOptions);
    logger.info("Payment result email sent", { to, outcome, orderNumber });
    return { delivered: true, devLogged: false };
  } catch (error) {
    logger.error("Failed to send payment result email", {
      to,
      error: error.message,
    });

        throwEmailDeliveryError(error);
  }
}

async function sendPersonalPortalConfirmation({
  to,
  name,
  confirmationReference,
  lookupExpiresAt,
}) {
  const portalUrl = `${(config.clientUrl || "http://localhost:3000").replace(/\/$/, "")}/personalrequest`;
  const expiresText = lookupExpiresAt
    ? new Date(lookupExpiresAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "7 days";

  const subject = `Personal records request confirmed — ${confirmationReference}`;
  const text = [
    `Hello ${name || "Patient"},`,
    "",
    "Your personal records request has been received and payment confirmed.",
    "",
    `Confirmation reference: ${confirmationReference}`,
    "",
    `You can check your request status at ${portalUrl} using your confirmation reference and date of birth.`,
    `Status lookup is available until ${expiresText}.`,
    "",
    "— DMS Document Management System",
  ].join("\n");

  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    if (config.nodeEnv === "development") {
      logger.warn("[DEV] Personal portal confirmation email", { to, text });
      return { delivered: false, devLogged: true };
    }
    throw new ApiError(503, "Email service is not configured");
  }

  const safeName = escapeHtml(name || "Patient");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827;">
      <h2 style="color:#0097B2;">Request Confirmed</h2>
      <p>Hi ${safeName}, your personal records request has been received and your processing fee payment was confirmed.</p>
      <p style="font-size:18px;font-weight:700;">Reference: ${escapeHtml(confirmationReference)}</p>
      <p>Check status at <a href="${escapeHtml(portalUrl)}">${escapeHtml(portalUrl)}</a> using your confirmation reference and date of birth.</p>
      <p style="color:#64748B;font-size:13px;">Status lookup available until ${escapeHtml(expiresText)}.</p>
    </div>`;

  try {
    await sendMailWithRetry(buildMailOptions({ to, subject, text, html }));
    return { delivered: true };
  } catch (error) {
    logger.error("Failed to send personal portal confirmation", {
      to,
      error: error.message,
    });

    // Never fail payment/fulfillment because of SMTP — log and soft-fail.
    if (config.nodeEnv === "development") {
      logger.warn("[DEV] Personal portal confirmation email (SMTP failed)", {
        to,
        text,
      });
      return { delivered: false, devLogged: true, error: error.message };
    }

    return { delivered: false, error: error.message };
  }
}

async function sendCompanyEmployeeCredentials({ to, name, email, password }) {
  const portalUrl = `${(config.clientUrl || "http://localhost:3000").replace(/\/$/, "")}/company-portal/login`;
  const subject = "Your Company Portal employee account";
  const text = [
    `Hello ${name},`,
    "",
    "Your company administrator created an employee account for you.",
    "",
    `Portal: ${portalUrl}`,
    `Email: ${email}`,
    `Password: ${password}`,
    "",
    "Use the Employee sign-in option on the login page.",
    "",
    "Keep these credentials secure.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0F172A;line-height:1.6;max-width:560px;">
      <h2 style="color:#0097B2;">Company Portal Employee Account</h2>
      <p>Hello ${escapeHtml(name)},</p>
      <p>Your company administrator created an employee account for you.</p>
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;"><strong>Portal:</strong> <a href="${escapeHtml(portalUrl)}">${escapeHtml(portalUrl)}</a></p>
        <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p style="margin:0;"><strong>Password:</strong> ${escapeHtml(password)}</p>
      </div>
      <p>Use the <strong>Employee sign-in</strong> option on the login page.</p>
      <p style="color:#64748B;font-size:13px;">Keep these credentials secure.</p>
    </div>`;

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    logger.warn("[DEV] Company employee credentials", {
      to,
      email,
      password,
      hint: "Set SMTP credentials in .env to send real emails",
    });
    return { devLogged: true };
  }

  try {
    await mailTransporter.sendMail(
      buildMailOptions({ to, subject, text, html })
    );
    logger.info("Company employee credentials email sent", { to });
    return { delivered: true };
  } catch (error) {
    logger.error("Failed to send company employee credentials", {
      to,
      error: error.message,
    });
    throwEmailDeliveryError(error);
  }
}

async function sendPersonalPortalResearchFeeRequest({
  to,
  name,
  confirmationReference,
  amount,
  payUrl,
}) {
  const amountLabel = Number(amount).toFixed(2);
  const subject = `Action required: $${amountLabel} facility search fee — ${confirmationReference}`;
  const text = [
    `Hello ${name || "Patient"},`,
    "",
    "Your personal records request used a facility that was not already in our list. Our team has located and confirmed the treating facility.",
    "",
    `Confirmation reference: ${confirmationReference}`,
    `Amount due: $${amountLabel}`,
    "",
    "Please pay this facility search fee to continue processing:",
    payUrl,
    "",
    "You can also pay from your Personal Request Portal dashboard.",
    "",
    "— DMS Document Management System",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827;">
      <h2 style="color:#0097B2;">Facility Search Fee Due</h2>
      <p>Hi ${escapeHtml(name || "Patient")}, your request <strong>${escapeHtml(
        confirmationReference
      )}</strong> needed a facility search because the treating facility was not in our list. We have now located and confirmed it.</p>
      <p style="font-size:18px;font-weight:700;">Amount due: $${escapeHtml(amountLabel)}</p>
      <p>
        <a href="${escapeHtml(payUrl)}"
           style="display:inline-block;background:#0097B2;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">
          Pay $${escapeHtml(amountLabel)} now
        </a>
      </p>
      <p style="color:#64748B;font-size:13px;">You can also pay from your Personal Request Portal dashboard.</p>
    </div>`;

  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    if (config.nodeEnv === "development") {
      logger.warn("[DEV] Personal portal research fee email", { to, text });
      return { delivered: false, devLogged: true };
    }
    throw new ApiError(503, "Email service is not configured");
  }

  try {
    await sendMailWithRetry(buildMailOptions({ to, subject, text, html }));
    return { delivered: true };
  } catch (error) {
    logger.error("Failed to send personal portal research fee email", {
      to,
      error: error.message,
    });
    if (config.nodeEnv === "development") {
      logger.warn("[DEV] Research fee email (SMTP failed)", { to, text });
      return { delivered: false, devLogged: true, error: error.message };
    }
    return { delivered: false, error: error.message };
  }
}

module.exports = {
  sendTwoFactorCode,
  sendInvoiceEmail,
  sendPaymentResultEmail,
  sendOrderCompletedMail,
  sendCopyServiceLetterEmail,
  sendCnrRecordEmail,
  sendCnrMemoEmail,
  sendCertificateOfRecordsEmail,
  sendPersonalPortalConfirmation,
  sendPersonalPortalResearchFeeRequest,
  sendCompanyEmployeeCredentials,
};
