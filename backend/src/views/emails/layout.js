const BRAND = {
  primary: "#0097B2",
  primaryDark: "#007F96",
  primaryLight: "#E6F7FA",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  surface: "#F8FAFC",
  white: "#FFFFFF",
  warning: "#EA580C",
  warningBg: "#FFF7ED",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatOtpBoxes(code) {
  const digits = String(code || "")
    .replace(/\D/g, "")
    .slice(0, 6)
    .padEnd(6, " ")
    .split("");

  return digits
    .map(
      (digit) => `
        <td align="center" style="padding:0 4px;">
          <div style="width:44px;height:52px;line-height:52px;background-color:${BRAND.white};border:2px solid ${BRAND.border};border-radius:10px;font-family:'SF Mono',Menlo,Monaco,Consolas,monospace;font-size:24px;font-weight:700;color:${BRAND.primaryDark};text-align:center;">
            ${escapeHtml(digit.trim() || "·")}
          </div>
        </td>`
    )
    .join("");
}

function wrapEmailHtml({ title, preheader = "", bodyHtml }) {
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${safeTitle}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .email-padding { padding: 24px 20px !important; }
      .otp-digit { width: 38px !important; height: 46px !important; line-height: 46px !important; font-size: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${safePreheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.surface};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding-bottom:20px;" align="center">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.primaryDark} 100%);border-radius:12px;padding:14px 22px;">
                    <span style="font-size:18px;font-weight:700;color:${BRAND.white};letter-spacing:0.5px;">DMS</span>
                    <span style="font-size:12px;font-weight:500;color:rgba(255,255,255,0.85);margin-left:8px;">Document Management</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.white};border-radius:16px;border:1px solid ${BRAND.border};overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">
                ${bodyHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 12px 8px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;line-height:18px;color:${BRAND.muted};">
                &copy; ${new Date().getFullYear()} DMS Document Management System
              </p>
              <p style="margin:0;font-size:11px;line-height:16px;color:#94A3B8;">
                This is an automated message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function infoRow(label, value, { highlight = false } = {}) {
  const valueColor = highlight ? BRAND.primaryDark : BRAND.text;
  const valueWeight = highlight ? "700" : "600";

  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="font-size:13px;color:${BRAND.muted};width:42%;">${escapeHtml(label)}</td>
            <td align="right" style="font-size:14px;font-weight:${valueWeight};color:${valueColor};">${escapeHtml(value)}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

module.exports = {
  BRAND,
  escapeHtml,
  formatOtpBoxes,
  wrapEmailHtml,
  infoRow,
};
