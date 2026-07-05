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

function generateCertificateOfRecordsPdf(data = {}) {
  const documentTitle = "Certificate of Records";
  const facilityAddressText = (data.facilityAddressLines || [])
    .filter(Boolean)
    .join(", ");

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

    writeCenteredLine(doc, documentTitle, {
      bold: true,
      fontSize: 14,
      spacingAfter: 1,
    });

    writeParagraph(doc, formatDisplayDate(data.documentDate), { spacingAfter: 0.8 });
    writeParagraph(doc, data.companyName || "", { bold: true, spacingAfter: 0.15 });

    (data.companyAddressLines || []).forEach((line) => {
      if (line) {
        writeParagraph(doc, line, { bold: true, spacingAfter: 0.15 });
      }
    });

    doc.moveDown(0.35);
    resetCursor(doc);

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

    const facilitySentence = facilityAddressText
      ? `${data.facilityName || "N/A"}, ${facilityAddressText}.`
      : `${data.facilityName || "N/A"}.`;

    writeParagraph(
      doc,
      `I, the undersigned, being the authorized Release of Information service for, ${facilitySentence}`
    );
    writeParagraph(doc, "Declare the following:");
    writeParagraph(
      doc,
      "Including this declaration, all records requested have been reproduced in my presence, under my direction and control. The copy submitted with the declaration is a true copy thereof."
    );
    writeParagraph(
      doc,
      "To the best of my knowledge all records referred to above, were prepared or complied by our personnel, in the ordinary course of business at or near the time of the acts, conditions, or events recorded."
    );
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
  generateCertificateOfRecordsPdf,
  formatDisplayDate,
};
