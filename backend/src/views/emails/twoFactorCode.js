const {
  BRAND,
  escapeHtml,
  formatOtpBoxes,
  wrapEmailHtml,
} = require("./layout");

function renderTwoFactorText({ name, code, expiresInMinutes, purpose }) {
  const isPasswordReset = purpose === "password_reset";

  return [
    `Hello ${name},`,
    "",
    isPasswordReset
      ? `Your DMS password reset code is: ${code}`
      : `Your DMS verification code is: ${code}`,
    "",
    `This code expires in ${expiresInMinutes} minutes.`,
    "",
    isPasswordReset
      ? "If you did not request a password reset, please ignore this email."
      : "If you did not request this code, please ignore this email.",
    "",
    "— DMS Document Management System",
  ].join("\n");
}

function renderTwoFactorHtml({ name, code, expiresInMinutes, purpose }) {
  const safeName = escapeHtml(name || "User");
  const otpBoxes = formatOtpBoxes(code);
  const isPasswordReset = purpose === "password_reset";
  const heading = isPasswordReset
    ? "Your password reset code"
    : "Your sign-in code";
  const intro = isPasswordReset
    ? `Hi ${safeName}, use the verification code below to confirm your password reset for your DMS account.`
    : `Hi ${safeName}, use the verification code below to complete two-factor authentication for your DMS account.`;
  const unusedNote = isPasswordReset
    ? "<strong>Didn't request this?</strong> You can safely ignore this email. Your password will not change until the code is used."
    : "<strong>Didn't request this?</strong> You can safely ignore this email. Your account remains secure and no changes were made.";

  const bodyHtml = `
    <tr>
      <td class="email-padding" style="padding:36px 40px 12px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${BRAND.primary};text-transform:uppercase;letter-spacing:1px;">Security Verification</p>
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;line-height:1.3;color:${BRAND.text};">${heading}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.muted};">
          ${intro}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 40px 28px;" align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>${otpBoxes}</tr>
        </table>
        <p style="margin:18px 0 0;font-size:13px;color:${BRAND.muted};">
          Code expires in <strong style="color:${BRAND.text};">${escapeHtml(expiresInMinutes)} minutes</strong>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.primaryLight};border-radius:12px;border:1px solid #BDECF3;">
          <tr>
            <td style="padding:16px 18px;">
              <p style="margin:0;font-size:13px;line-height:1.55;color:${BRAND.primaryDark};">
                ${unusedNote}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return wrapEmailHtml({
    title: isPasswordReset
      ? "Your DMS password reset code"
      : "Your DMS verification code",
    preheader: isPasswordReset
      ? `Your password reset code is ${code}. It expires in ${expiresInMinutes} minutes.`
      : `Your verification code is ${code}. It expires in ${expiresInMinutes} minutes.`,
    bodyHtml,
  });
}

module.exports = { renderTwoFactorText, renderTwoFactorHtml };
