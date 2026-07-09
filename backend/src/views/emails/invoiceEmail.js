const { BRAND, escapeHtml, wrapEmailHtml, infoRow } = require("./layout");

function buildRushBanner(isRushOrder, rushLevel) {
  if (!isRushOrder) return "";

  const rushLabel = rushLevel ? escapeHtml(rushLevel) : "Rush";

  return `
    <tr>
      <td style="padding:0 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.dangerBg};border-radius:12px;border:1px solid #FECACA;">
          <tr>
            <td style="padding:14px 18px;">
              <p style="margin:0;font-size:14px;font-weight:700;color:${BRAND.danger};">
                ⚡ Rush Order — ${rushLabel}
              </p>
              <p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#991B1B;">
                This invoice is marked as a priority rush order. Please process accordingly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function buildOrderDetailsSection(sendOrderDetails, orderDetailsText) {
  if (!sendOrderDetails || !orderDetailsText) return "";

  const lines = String(orderDetailsText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 6px;font-size:13px;line-height:1.55;color:${BRAND.text};">${escapeHtml(line)}</p>`
    )
    .join("");

  return `
    <tr>
      <td style="padding:0 40px 24px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.8px;">Order Details</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.surface};border-radius:12px;border:1px solid ${BRAND.border};">
          <tr>
            <td style="padding:16px 18px;">${lines}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function buildPayOnlineSection(paymentUrl) {
  if (!paymentUrl) return "";

  return `
    <tr>
      <td style="padding:0 40px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.primaryLight};border-radius:12px;border:1px solid #BDECF3;">
          <tr>
            <td style="padding:18px 20px;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${BRAND.primaryDark};">
                Pay Online
              </p>
              <p style="margin:0 0 14px;font-size:13px;line-height:1.55;color:${BRAND.text};">
                If you would like to pay this invoice online, please use the secure link below.
              </p>
              <a href="${escapeHtml(paymentUrl)}" style="display:inline-block;background-color:${BRAND.primary};color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 18px;border-radius:8px;">
                Pay Invoice Online
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderInvoiceText({
  companyName,
  caseNo,
  applicant,
  invoiceDate,
  sentDate,
  invoiced,
  paid,
  due,
  isResend,
  reminderLevel = null,
  sendOrderDetails,
  isRushOrder,
  rushLevel,
  orderDetailsText,
  paymentUrl = null,
}) {
  const reminderNumber = Number(reminderLevel) || 0;
  const isReminder = reminderNumber > 0;

  return [
    `Dear ${companyName},`,
    "",
    isReminder
      ? `This is reminder ${reminderNumber} for the outstanding invoice below:`
      : isResend
        ? "Please find the resent invoice details below:"
        : "Please find the invoice details below:",
    "",
    ...(isRushOrder
      ? [
          "This is a rush order.",
          rushLevel ? `Rush Level: ${rushLevel}` : "",
          "",
        ].filter(Boolean)
      : []),
    `Case Number: ${caseNo}`,
    `Applicant: ${applicant || "N/A"}`,
    `Invoice Date: ${invoiceDate || "N/A"}`,
    `Sent Date: ${sentDate || "N/A"}`,
    `Invoiced: ${invoiced}`,
    `Paid: ${paid}`,
    `Due: ${due}`,
    ...(sendOrderDetails && orderDetailsText
      ? ["", "Order Details:", orderDetailsText]
      : []),
    ...(paymentUrl
      ? [
          "",
          "Pay Online:",
          "If you would like to pay this invoice online, use this secure link:",
          paymentUrl,
        ]
      : []),
    "",
    "Thank you,",
    "DMS Document Management System",
  ].join("\n");
}

function renderInvoiceHtml({
  companyName,
  caseNo,
  applicant,
  invoiceDate,
  sentDate,
  invoiced,
  paid,
  due,
  isResend,
  reminderLevel = null,
  sendOrderDetails,
  isRushOrder,
  rushLevel,
  orderDetailsText,
  paymentUrl = null,
}) {
  const safeCompany = escapeHtml(companyName || "Valued Customer");
  const reminderNumber = Number(reminderLevel) || 0;
  const isReminder = reminderNumber > 0;
  const heading = isReminder
    ? `Invoice Reminder ${reminderNumber}`
    : isResend
      ? "Invoice Resent"
      : "Invoice Notification";
  const intro = isReminder
    ? `This is reminder ${reminderNumber} for your outstanding invoice. Please review the details below.`
    : isResend
      ? "Please review the updated invoice details below."
      : "Please find your invoice summary below for your records.";

  const badgeColor = isReminder ? "#FEF3C7" : isResend ? BRAND.warningBg : BRAND.primaryLight;
  const badgeBorder = isReminder ? "#FCD34D" : isResend ? "#FDBA74" : "#BDECF3";
  const badgeText = isReminder ? "#B45309" : isResend ? BRAND.warning : BRAND.primaryDark;
  const badgeLabel = isReminder
    ? `Reminder ${reminderNumber}`
    : isResend
      ? "Resent Invoice"
      : "New Invoice";

  const bodyHtml = `
    <tr>
      <td class="email-padding" style="padding:36px 40px 8px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="background-color:${badgeColor};border:1px solid ${badgeBorder};border-radius:999px;padding:6px 14px;">
              <span style="font-size:11px;font-weight:700;color:${badgeText};text-transform:uppercase;letter-spacing:0.8px;">${badgeLabel}</span>
            </td>
          </tr>
        </table>
        <h1 style="margin:16px 0 8px;font-size:24px;font-weight:700;line-height:1.3;color:${BRAND.text};">${heading}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.muted};">
          Dear ${safeCompany}, ${intro}
        </p>
      </td>
    </tr>
    ${buildRushBanner(isRushOrder, rushLevel)}
    <tr>
      <td style="padding:12px 40px 8px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.8px;">Invoice Summary</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          ${infoRow("Case Number", caseNo, { highlight: true })}
          ${infoRow("Applicant", applicant || "N/A")}
          ${infoRow("Invoice Date", invoiceDate || "N/A")}
          ${infoRow("Sent Date", sentDate || "N/A")}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 40px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.surface};border-radius:12px;border:1px solid ${BRAND.border};">
          <tr>
            <td style="padding:18px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="33%" align="center" style="padding:8px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${BRAND.muted};text-transform:uppercase;">Invoiced</p>
                    <p style="margin:0;font-size:18px;font-weight:700;color:${BRAND.text};">${escapeHtml(invoiced)}</p>
                  </td>
                  <td width="33%" align="center" style="padding:8px;border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${BRAND.muted};text-transform:uppercase;">Paid</p>
                    <p style="margin:0;font-size:18px;font-weight:700;color:#059669;">${escapeHtml(paid)}</p>
                  </td>
                  <td width="33%" align="center" style="padding:8px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${BRAND.muted};text-transform:uppercase;">Due</p>
                    <p style="margin:0;font-size:18px;font-weight:700;color:${BRAND.danger};">${escapeHtml(due)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${buildOrderDetailsSection(sendOrderDetails, orderDetailsText)}
    ${buildPayOnlineSection(paymentUrl)}
    <tr>
      <td style="padding:0 40px 36px;">
        <p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.muted};">
          Thank you for your business.<br />
          <strong style="color:${BRAND.text};">DMS Document Management System</strong>
        </p>
      </td>
    </tr>`;

  const preheader = isReminder
    ? `Reminder ${reminderNumber} for case ${caseNo} — Due: ${due}`
    : `Invoice for case ${caseNo} — Due: ${due}`;

  return wrapEmailHtml({
    title: isReminder
      ? `Reminder ${reminderNumber} - Case ${caseNo}`
      : isResend
        ? `Resent Invoice - Case ${caseNo}`
        : `Invoice - Case ${caseNo}`,
    preheader,
    bodyHtml,
  });
}

module.exports = { renderInvoiceText, renderInvoiceHtml };
