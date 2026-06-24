const PDFDocument = require("pdfkit");
const {
  SHEET_COMPANY_INFO,
  CNR_SIGNER,
} = require("../constants/sheetTemplateConstants");

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

function resetCursor(doc) {
  doc.x = doc.page.margins.left;
}

function ensureSpace(doc, height = 48) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    resetCursor(doc);
  }
}

function formatDisplayDate(date) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
    .fillColor(options.color || "#111827")
    .text(text, left, doc.y, {
      width,
      align: "center",
      lineGap: options.lineGap ?? 1,
    });

  if (options.spacingAfter !== false) {
    doc.moveDown(options.spacingAfter ?? 0.35);
    resetCursor(doc);
  }
}

function writeParagraph(doc, text, options = {}) {
  const { width, left } = getContentBox(doc);

  ensureSpace(doc, 60);
  resetCursor(doc);

  doc
    .font(options.bold ? "Times-Bold" : "Times-Roman")
    .fontSize(options.fontSize || 11)
    .fillColor(options.color || "#111827")
    .text(text, left, doc.y, {
      width,
      align: options.align || "left",
      lineGap: options.lineGap ?? 2,
    });

  if (options.spacingAfter !== false) {
    doc.moveDown(options.spacingAfter ?? 0.7);
    resetCursor(doc);
  }
}

function drawLetterhead(doc) {
  const { width, left, centerX } = getContentBox(doc);

  writeCenteredLine(doc, `"${SHEET_COMPANY_INFO.tagline}"`, {
    italic: true,
    fontSize: 10,
    color: "#6B7280",
    spacingAfter: 0.9,
  });

  const logoY = doc.y + 4;
  const logoRadius = 22;

  doc.circle(centerX, logoY + logoRadius, logoRadius).stroke("#111827");
  resetCursor(doc);

  doc
    .font("Times-Bold")
    .fontSize(17)
    .fillColor("#111827")
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
    color: "#64748B",
    spacingAfter: 0.1,
  });
  writeCenteredLine(doc, SHEET_COMPANY_INFO.cityStateZip, {
    fontSize: 10,
    color: "#64748B",
    spacingAfter: 0.1,
  });
  writeCenteredLine(doc, SHEET_COMPANY_INFO.email, {
    fontSize: 10,
    color: "#007F96",
    spacingAfter: 1.2,
  });
}

function generateCnrMemoPdf(data = {}) {
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

    writeCenteredLine(doc, "Memo", {
      bold: true,
      fontSize: 14,
      spacingAfter: 1,
    });

    writeParagraph(doc, formatDisplayDate(data.memoDate), { spacingAfter: 0.8 });
    writeParagraph(doc, data.recipientCompany || "", { bold: true, spacingAfter: 0.8 });

    const { width, left } = getContentBox(doc);
    const indent = 32;

    ensureSpace(doc, 24);
    resetCursor(doc);
    doc
      .font("Times-Bold")
      .fontSize(11)
      .text("Regarding:", left + indent, doc.y, { continued: true, lineBreak: false });
    doc.font("Times-Roman").text(` ${data.applicant || "N/A"}`);
    doc.moveDown(0.35);
    resetCursor(doc);

    doc
      .font("Times-Bold")
      .fontSize(11)
      .text("Reference #", left + indent, doc.y, { continued: true, lineBreak: false });
    doc.font("Times-Roman").text(` ${data.reference || ""}`);
    doc.moveDown(0.8);
    resetCursor(doc);

    writeParagraph(
      doc,
      `I understand, being the authorized Release of Information for: ${data.facilityName || "N/A"}`
    );
    writeParagraph(doc, "Declare the following:");
    writeParagraph(
      doc,
      "We certify that a thorough search of our files, carried out under our direction and control revealed no records on the patient named in the Subpoena / Authorization for the above named medical facility / doctor."
    );

    if (data.cnrReason) {
      writeParagraph(doc, data.cnrReason, { bold: true, spacingAfter: 0.8 });
    }

    writeParagraph(
      doc,
      "I declare under penalty of perjury, under the law of the State of California, that the foregoing is true and correct.",
      { spacingAfter: 1.2 }
    );

    writeParagraph(doc, CNR_SIGNER.name, { bold: true, spacingAfter: 0.15 });
    writeParagraph(doc, CNR_SIGNER.title, { spacingAfter: 0.15 });
    writeParagraph(doc, SHEET_COMPANY_INFO.companyName, { spacingAfter: 0 });

    doc.end();
  });
}

module.exports = {
  generateCnrMemoPdf,
  formatDisplayDate,
};
