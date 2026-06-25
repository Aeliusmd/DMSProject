const PDFDocument = require("pdfkit");
const { SHEET_COMPANY_INFO } = require("../constants/sheetTemplateConstants");

const BODY_WIDTH_RATIO = 0.84;

const COLORS = {
  text: "#111827",
  muted: "#64748B",
  body: "#334155",
  link: "#007F96",
  rule: "#CBD5E1",
};

function getContentBox(doc) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  return {
    left,
    right,
    width: right - left,
    centerX: left + (right - left) / 2,
  };
}

function getBodyBox(doc) {
  const { left, width } = getContentBox(doc);
  const bodyWidth = width * BODY_WIDTH_RATIO;
  const bodyLeft = left + (width - bodyWidth) / 2;

  return {
    left: bodyLeft,
    width: bodyWidth,
    right: bodyLeft + bodyWidth,
  };
}

function resetCursor(doc) {
  doc.x = doc.page.margins.left;
}

function ensureSpace(doc, height = 48) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    resetCursor(doc);
  }
}

function formatMoney(value) {
  const amount = Number(value);
  const safe = Number.isNaN(amount) ? 0 : amount;

  return `$${safe.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function writeCenteredLine(doc, text, options = {}) {
  const { width, left } = getContentBox(doc);

  resetCursor(doc);
  doc
    .font(
      options.bold
        ? "Times-Bold"
        : options.italic
          ? "Times-Italic"
          : "Times-Roman"
    )
    .fontSize(options.fontSize || 10)
    .fillColor(options.color || COLORS.text)
    .text(text, left, doc.y, {
      width,
      align: "center",
      lineGap: options.lineGap ?? 1,
      underline: Boolean(options.underline),
    });

  if (options.spacingAfter !== false) {
    doc.moveDown(options.spacingAfter ?? 0.35);
    resetCursor(doc);
  }
}

function drawLetterhead(doc) {
  const { width, left, centerX } = getContentBox(doc);

  writeCenteredLine(doc, `"${SHEET_COMPANY_INFO.tagline}"`, {
    italic: true,
    fontSize: 10,
    color: COLORS.muted,
    spacingAfter: 0.9,
  });

  const logoY = doc.y + 4;
  const logoRadius = 22;

  doc.circle(centerX, logoY + logoRadius, logoRadius).stroke(COLORS.text);
  resetCursor(doc);

  doc
    .font("Times-Bold")
    .fontSize(17)
    .fillColor(COLORS.text)
    .text(SHEET_COMPANY_INFO.logoText, left, logoY + 14, {
      width,
      align: "center",
      lineBreak: false,
    });

  doc.y = logoY + logoRadius * 2 + 14;
  resetCursor(doc);

  writeCenteredLine(doc, SHEET_COMPANY_INFO.companyName, {
    bold: true,
    fontSize: 11,
    spacingAfter: 0.2,
  });
  writeCenteredLine(doc, SHEET_COMPANY_INFO.addressLine1, {
    fontSize: 10,
    color: COLORS.muted,
    spacingAfter: 0.1,
  });
  writeCenteredLine(doc, SHEET_COMPANY_INFO.cityStateZip, {
    fontSize: 10,
    color: COLORS.muted,
    spacingAfter: 0.1,
  });
  writeCenteredLine(doc, SHEET_COMPANY_INFO.email, {
    fontSize: 10,
    color: COLORS.link,
    underline: true,
    spacingAfter: 1.2,
  });
}

function writeCenteredTitle(doc, text) {
  const { width, left } = getContentBox(doc);

  ensureSpace(doc, 36);
  resetCursor(doc);

  doc
    .font("Times-Bold")
    .fontSize(12)
    .fillColor(COLORS.text)
    .text(text, left, doc.y, {
      width,
      align: "center",
      underline: true,
    });

  doc.moveDown(0.9);
  resetCursor(doc);
}

function writeSectionHeading(doc, text) {
  const { left, width } = getBodyBox(doc);

  ensureSpace(doc, 24);
  resetCursor(doc);

  doc
    .font("Times-Bold")
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(text, left, doc.y, {
      width,
      align: "center",
    });

  doc.moveDown(0.5);
  resetCursor(doc);
}

function writeInfoLine(doc, label, value) {
  const { left, width } = getBodyBox(doc);

  ensureSpace(doc, 20);
  resetCursor(doc);

  doc
    .font("Times-Bold")
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(`${label} `, left, doc.y, { continued: true, lineBreak: false });

  doc
    .font("Times-Roman")
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(String(value || "N/A"), {
      width,
      lineGap: 1,
    });

  doc.moveDown(0.25);
  resetCursor(doc);
}

function drawFeeTable(doc, feeLines = []) {
  const { left, width, right } = getBodyBox(doc);
  const col1 = left;
  const col2 = left + width * 0.62;
  const col3 = left + width * 0.78;
  const col3Width = right - col3;
  const rowHeight = 18;

  ensureSpace(doc, rowHeight * (feeLines.length + 6));
  resetCursor(doc);

  const headerY = doc.y;

  doc
    .font("Times-Bold")
    .fontSize(10)
    .fillColor(COLORS.text)
    .text("Breakdown of Fees", col1, headerY, {
      width: width * 0.55,
      underline: true,
    });
  doc.text("Qty.", col2, headerY, {
    width: width * 0.14,
    align: "center",
    underline: true,
  });
  doc.text("Total", col3, headerY, {
    width: col3Width,
    align: "right",
    underline: true,
  });

  doc
    .moveTo(left, headerY + rowHeight - 6)
    .lineTo(right, headerY + rowHeight - 6)
    .stroke(COLORS.rule);

  doc.y = headerY + rowHeight - 2;
  resetCursor(doc);

  feeLines.forEach((line) => {
    ensureSpace(doc, rowHeight);
    const rowY = doc.y;

    if (line.separatorBefore) {
      doc
        .moveTo(left, rowY - 2)
        .lineTo(right, rowY - 2)
        .stroke(COLORS.rule);
    }

    const isItalic = line.italic;
    const isBold = line.bold;
    const descriptionFont = isBold
      ? "Times-Bold"
      : isItalic
        ? "Times-Italic"
        : "Times-Roman";
    const valueFont = isBold
      ? "Times-Bold"
      : isItalic
        ? "Times-Italic"
        : "Times-Roman";

    if (line.descriptionSuffix) {
      doc
        .font("Times-Bold")
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(line.description, col1, rowY, { continued: true, lineBreak: false });
      doc
        .font("Times-Italic")
        .fontSize(9)
        .text(` ${line.descriptionSuffix}`, { continued: false });
    } else {
      doc
        .font(descriptionFont)
        .fontSize(10)
        .fillColor(COLORS.body)
        .text(line.description, col1, rowY, { width: width * 0.58 });
    }

    doc
      .font(valueFont)
      .fontSize(10)
      .fillColor(isBold ? COLORS.text : COLORS.body)
      .text(line.quantity ? String(line.quantity) : "", col2, rowY, {
        width: width * 0.14,
        align: "center",
      });

    doc
      .font(valueFont)
      .text(formatMoney(line.total), col3, rowY, {
        width: col3Width,
        align: "right",
      });

    doc.y = rowY + rowHeight - 4;
    resetCursor(doc);
  });

  doc.moveDown(0.4);
  resetCursor(doc);
}

function writeBodyParagraph(doc, text, options = {}) {
  const { left, width } = getBodyBox(doc);

  ensureSpace(doc, 40);
  resetCursor(doc);

  doc
    .font(options.bold ? "Times-Bold" : "Times-Roman")
    .fontSize(options.fontSize || 11)
    .fillColor(options.color || COLORS.body)
    .text(text, left, doc.y, {
      width,
      align: options.align || "left",
      lineGap: options.lineGap ?? 2,
    });

  doc.moveDown(options.spacingAfter ?? 0.6);
  resetCursor(doc);
}

function writeFooterParagraph(doc, text, options = {}) {
  const { width, left } = getContentBox(doc);

  ensureSpace(doc, 40);
  resetCursor(doc);

  doc
    .font(options.bold ? "Times-Bold" : "Times-Roman")
    .fontSize(options.fontSize || 10)
    .fillColor(options.color || COLORS.body)
    .text(text, left, doc.y, {
      width,
      align: "center",
      lineGap: options.lineGap ?? 2,
    });

  doc.moveDown(options.spacingAfter ?? 0.6);
  resetCursor(doc);
}

function writeFooterAsteriskLine(doc, text) {
  writeFooterParagraph(doc, `**${text}**`, {
    bold: true,
    fontSize: 10,
    color: COLORS.text,
    spacingAfter: 0.4,
  });
}

function writeFooterEmailLine(doc) {
  const { width, left } = getContentBox(doc);
  const prefix = "If you have any questions please email me at ";
  const email = SHEET_COMPANY_INFO.email;

  ensureSpace(doc, 30);
  resetCursor(doc);

  doc.font("Times-Roman").fontSize(10);

  const fullLine = `${prefix}${email}`;
  const fullWidth = doc.widthOfString(fullLine);
  const startX = left + Math.max(0, (width - fullWidth) / 2);
  const y = doc.y;

  doc
    .fillColor(COLORS.body)
    .text(prefix, startX, y, { lineBreak: false, continued: true });

  doc.fillColor(COLORS.link).text(email, { underline: true, continued: false });

  doc.moveDown(0.6);
  resetCursor(doc);
}

function generatePrintInvoicePdf(data = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 54, bottom: 54, left: 72, right: 72 },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    resetCursor(doc);
    drawLetterhead(doc);
    writeCenteredTitle(doc, "Your request for records is ready");
    writeSectionHeading(doc, "Patient Information");

    writeInfoLine(doc, "Customer:", data.customer);
    writeInfoLine(doc, "Requested By:", data.requestedBy);
    writeInfoLine(doc, "Your File #:", data.yourFileNumber);
    writeInfoLine(doc, "Our Case #:", data.ourCaseNumber);
    writeInfoLine(doc, "Applicant:", data.applicant);

    doc.moveDown(0.4);
    resetCursor(doc);

    writeBodyParagraph(
      doc,
      "The following charges are for records copied by our office and all charges follow California Labor Code 1563.",
      { fontSize: 11, spacingAfter: 0.8 }
    );

    const feeLines = Array.isArray(data.feeLines) ? [...data.feeLines] : [];
    feeLines.push(
      {
        description: "Total Invoiced",
        quantity: "",
        total: data.totalInvoiced,
        bold: true,
        italic: true,
      },
      {
        description: "Total Due w/f subtracted from total if paid",
        quantity: "",
        total: data.totalDue,
        bold: true,
        italic: true,
        separatorBefore: true,
      }
    );
    drawFeeTable(doc, feeLines);

    writeFooterParagraph(
      doc,
      "Records will be emailed once balance is paid.",
      { fontSize: 10, spacingAfter: 0.5 }
    );
    writeFooterParagraph(
      doc,
      "If you would like records on CD,\nan additional charge of $10 will be added to total due.",
      { fontSize: 10, spacingAfter: 0.8 }
    );
    writeFooterAsteriskLine(
      doc,
      "All fees must be paid before we can release records. "
    );
    writeFooterAsteriskLine(
      doc,
      "Please make check or Money order payable to Document Management Services"
    );
    writeFooterEmailLine(doc);

    doc.end();
  });
}

module.exports = {
  generatePrintInvoicePdf,
  drawLetterhead,
  writeCenteredTitle,
  writeSectionHeading,
  writeInfoLine,
  writeBodyParagraph,
  writeFooterParagraph,
  writeFooterAsteriskLine,
  writeFooterEmailLine,
  drawFeeTable,
  getBodyBox,
  resetCursor,
  ensureSpace,
  formatMoney,
  COLORS,
};
