const { BRAND, escapeHtml, wrapEmailHtml, infoRow } = require("./layout");

function renderPaymentResultText({
  outcome,
  companyName,
  orderNumber,
  invoiceNumber,
  amount,
  failureMessage,
}) {
  const isSuccess = outcome === "success";

  return [
    `Dear ${companyName || "Customer"},`,
    "",
    isSuccess
      ? "Thank you — your online payment was received successfully."
      : "We were unable to complete your online payment.",
    "",
    `Order: ${orderNumber || "N/A"}`,
    `Invoice: ${invoiceNumber || "N/A"}`,
    `Amount: ${amount || "N/A"}`,
    ...(isSuccess
      ? ["", "Your invoice has been marked as paid in our system."]
      : ["", `Reason: ${failureMessage || "Payment was not completed"}`]),
    "",
    "Thank you,",
    "DMS Document Management System",
  ].join("\n");
}

function renderPaymentResultHtml({
  outcome,
  companyName,
  orderNumber,
  invoiceNumber,
  amount,
  failureMessage,
  receiptUrl,
}) {
  const isSuccess = outcome === "success";
  const safeCompany = escapeHtml(companyName || "Customer");
  const heading = isSuccess ? "Payment Successful" : "Payment Failed";
  const intro = isSuccess
    ? "Thank you for your payment. Your invoice has been marked as paid."
    : "We were unable to process your payment. Please review the details below and try again.";

  const bodyHtml = `
    <tr>
      <td class="email-padding" style="padding:36px 40px 8px;">
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;line-height:1.3;color:${BRAND.text};">${heading}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.muted};">
          Dear ${safeCompany}, ${intro}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 40px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          ${infoRow("Order", orderNumber)}
          ${infoRow("Invoice", invoiceNumber)}
          ${infoRow("Amount", amount, { highlight: true })}
          ${
            isSuccess
              ? ""
              : infoRow("Failure Reason", failureMessage || "Payment was not completed")
          }
        </table>
      </td>
    </tr>
    ${
      isSuccess && receiptUrl
        ? `<tr><td style="padding:0 40px 24px;"><a href="${escapeHtml(receiptUrl)}" style="color:${BRAND.primary};font-weight:600;">View Stripe receipt</a></td></tr>`
        : ""
    }
    <tr>
      <td style="padding:0 40px 36px;">
        <p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.muted};">
          <strong style="color:${BRAND.text};">DMS Document Management System</strong>
        </p>
      </td>
    </tr>`;

  return wrapEmailHtml({
    title: heading,
    preheader: isSuccess
      ? `Payment received for ${invoiceNumber}`
      : `Payment failed for ${invoiceNumber}`,
    bodyHtml,
  });
}

module.exports = { renderPaymentResultText, renderPaymentResultHtml };
