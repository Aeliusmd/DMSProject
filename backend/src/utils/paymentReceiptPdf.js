const PDFDocument = require("pdfkit");

const COLORS = {
  primary: "#007F96",
  primaryDark: "#005F72",
  primaryLight: "#E6F7FA",
  success: "#059669",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  text: "#111827",
  body: "#334155",
  muted: "#64748B",
  border: "#E2E8F0",
  surface: "#F8FAFC",
  white: "#FFFFFF",
};

const PAGE_MARGIN = 48;

function formatMoney(value) {
  const amount = Number(value);
  const safe = Number.isNaN(amount) ? 0 : amount;

  return `$${safe.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLabel(value) {
  if (!value) return "—";
  return `${value}`.charAt(0).toUpperCase() + `${value}`.slice(1);
}

function drawRoundedRect(doc, x, y, width, height, radius, fillColor) {
  doc.roundedRect(x, y, width, height, radius).fill(fillColor);
}

function drawDetailRow(doc, x, y, width, label, value, options = {}) {
  const labelWidth = options.labelWidth || 130;
  const rowHeight = options.rowHeight || 22;

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(label, x, y, { width: labelWidth, lineBreak: false });

  doc
    .font(options.mono ? "Courier" : "Helvetica-Bold")
    .fontSize(options.mono ? 8.5 : 9.5)
    .fillColor(COLORS.body)
    .text(value || "—", x + labelWidth, y, {
      width: width - labelWidth,
      lineBreak: false,
    });

  return y + rowHeight;
}

function generatePaymentReceiptPdf(payment = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: PAGE_MARGIN });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - PAGE_MARGIN * 2;
    const invoiceTypeLabel =
      payment.invoice_type === "xray" ? "X-Ray Invoice" : "Regular Invoice";
    const amountPaid = formatMoney(payment.amount);
    const paymentMethod = formatLabel(payment.payment_method_type || "card");
    const cardLine = payment.card_last4
      ? `${formatLabel(payment.card_brand || "Card")} •••• ${payment.card_last4}`
      : null;

    let y = PAGE_MARGIN;

    drawRoundedRect(doc, PAGE_MARGIN, y, contentWidth, 88, 10, COLORS.primary);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(COLORS.white)
      .text("DMS Document Management System", PAGE_MARGIN + 24, y + 22, {
        width: contentWidth - 48,
        align: "center",
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor(COLORS.white)
      .text("Payment Receipt", PAGE_MARGIN + 24, y + 42, {
        width: contentWidth - 48,
        align: "center",
      });

    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor("#BDECF3")
      .text("Official payment confirmation", PAGE_MARGIN + 24, y + 68, {
        width: contentWidth - 48,
        align: "center",
      });

    y += 104;

    drawRoundedRect(doc, PAGE_MARGIN, y, contentWidth, 78, 10, COLORS.successBg);
    doc
      .roundedRect(PAGE_MARGIN, y, contentWidth, 78, 10)
      .lineWidth(1)
      .strokeColor(COLORS.successBorder)
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.success)
      .text("PAID", PAGE_MARGIN + 20, y + 20);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text("Payment Status", PAGE_MARGIN + 20, y + 34);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text("Amount Received", PAGE_MARGIN + contentWidth - 170, y + 18, {
        width: 150,
        align: "right",
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor(COLORS.text)
      .text(amountPaid, PAGE_MARGIN + contentWidth - 170, y + 34, {
        width: 150,
        align: "right",
      });

    y += 96;

    const section = (title, startY) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(title.toUpperCase(), PAGE_MARGIN, startY);

      const headerY = startY + 16;
      drawRoundedRect(
        doc,
        PAGE_MARGIN,
        headerY,
        contentWidth,
        1,
        0,
        COLORS.border
      );

      return headerY + 12;
    };

    y = section("Order Information", y);

    const boxPadding = 18;
    const orderRows = [
      ["Order Number", payment.order_number || String(payment.order_id || "—")],
      ["Case Number", payment.case_number || "—"],
      ["Company", payment.company_name || "—"],
      ["Applicant", payment.applicant_name || "—"],
    ];

    const orderBoxHeight = orderRows.length * 22 + boxPadding * 2;
    drawRoundedRect(
      doc,
      PAGE_MARGIN,
      y,
      contentWidth,
      orderBoxHeight,
      8,
      COLORS.surface
    );
    doc
      .roundedRect(PAGE_MARGIN, y, contentWidth, orderBoxHeight, 8)
      .lineWidth(1)
      .strokeColor(COLORS.border)
      .stroke();

    let rowY = y + boxPadding;
    orderRows.forEach(([label, value]) => {
      rowY = drawDetailRow(
        doc,
        PAGE_MARGIN + 16,
        rowY,
        contentWidth - 32,
        label,
        value
      );
    });

    y += orderBoxHeight + 22;
    y = section("Payment Information", y);

    const paymentRows = [
      ["Invoice Number", payment.invoice_number || "—"],
      ["Invoice Type", invoiceTypeLabel],
      ["Payment Date", formatDateTime(payment.paid_at)],
      ["Payment Method", paymentMethod],
    ];

    if (cardLine) {
      paymentRows.push(["Card", cardLine]);
    }

    if (payment.customer_email) {
      paymentRows.push(["Customer Email", payment.customer_email]);
    }

    if (payment.customer_name) {
      paymentRows.push(["Customer Name", payment.customer_name]);
    }

    paymentRows.push([
      "Stripe Payment ID",
      payment.stripe_payment_intent_id || "—",
    ]);

    const paymentBoxHeight = paymentRows.length * 22 + boxPadding * 2;
    drawRoundedRect(
      doc,
      PAGE_MARGIN,
      y,
      contentWidth,
      paymentBoxHeight,
      8,
      COLORS.white
    );
    doc
      .roundedRect(PAGE_MARGIN, y, contentWidth, paymentBoxHeight, 8)
      .lineWidth(1)
      .strokeColor(COLORS.border)
      .stroke();

    rowY = y + boxPadding;
    paymentRows.forEach(([label, value], index) => {
      const isMono = label === "Stripe Payment ID";
      rowY = drawDetailRow(
        doc,
        PAGE_MARGIN + 16,
        rowY,
        contentWidth - 32,
        label,
        value,
        { mono: isMono }
      );

      if (index < paymentRows.length - 1) {
        doc
          .moveTo(PAGE_MARGIN + 16, rowY - 8)
          .lineTo(PAGE_MARGIN + contentWidth - 16, rowY - 8)
          .lineWidth(0.5)
          .strokeColor(COLORS.border)
          .stroke();
      }
    });

    y += paymentBoxHeight + 28;

    drawRoundedRect(doc, PAGE_MARGIN, y, contentWidth, 54, 8, COLORS.primaryLight);
    doc
      .roundedRect(PAGE_MARGIN, y, contentWidth, 54, 8)
      .lineWidth(1)
      .strokeColor("#BDECF3")
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.primaryDark)
      .text("Thank you for your payment.", PAGE_MARGIN + 20, y + 14, {
        width: contentWidth - 40,
        align: "center",
      });

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(
        "Please retain this receipt for your records. This document confirms that your invoice payment was received successfully.",
        PAGE_MARGIN + 20,
        y + 30,
        {
          width: contentWidth - 40,
          align: "center",
          lineGap: 2,
        }
      );

    const footerY = doc.page.height - PAGE_MARGIN - 18;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        `Generated on ${formatDateTime(new Date())}`,
        PAGE_MARGIN,
        footerY,
        {
          width: contentWidth,
          align: "center",
        }
      );

    doc.end();
  });
}

module.exports = { generatePaymentReceiptPdf };
