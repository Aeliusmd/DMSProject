const PDFDocument = require("pdfkit");
const {
  drawLetterhead,
  writeCenteredTitle,
  writeSectionHeading,
  writeInfoLine,
  writeBodyParagraph,
  writeFooterAsteriskLine,
  writeFooterEmailLine,
  getBodyBox,
  resetCursor,
  ensureSpace,
  formatMoney,
  COLORS,
} = require("./printInvoicePdf");

function formatSignedMoney(value) {
  const amount = Number(value);
  const safe = Number.isNaN(amount) ? 0 : amount;
  const abs = Math.abs(safe);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return safe < 0 ? `$-${formatted}` : `$${formatted}`;
}

function drawXrayFeeTable(doc, feeLines = []) {
  const { left, width, right } = getBodyBox(doc);
  const col1 = left;
  const col2 = left + width * 0.62;
  const col3 = left + width * 0.78;
  const col3Width = right - col3;
  const baseRowHeight = 18;

  ensureSpace(doc, baseRowHeight * (feeLines.length + 6));
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
    .moveTo(left, headerY + baseRowHeight - 6)
    .lineTo(right, headerY + baseRowHeight - 6)
    .stroke(COLORS.rule);

  doc.y = headerY + baseRowHeight - 2;
  resetCursor(doc);

  feeLines.forEach((line) => {
    let subDescriptionHeight = 0;

    if (line.subDescription) {
      doc.font("Times-Roman").fontSize(9);
      subDescriptionHeight =
        doc.heightOfString(line.subDescription, { width: width * 0.58 }) + 6;
    }

    const rowHeight = baseRowHeight + subDescriptionHeight;
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
    const valueFont = descriptionFont;
    const moneyText =
      line.total < 0 ? formatSignedMoney(line.total) : formatMoney(line.total);

    doc
      .font(descriptionFont)
      .fontSize(10)
      .fillColor(isBold ? COLORS.text : COLORS.body)
      .text(line.description, col1, rowY, { width: width * 0.58 });

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
      .text(moneyText, col3, rowY, {
        width: col3Width,
        align: "right",
      });

    if (line.subDescription) {
      doc
        .font("Times-Roman")
        .fontSize(9)
        .fillColor(COLORS.body)
        .text(line.subDescription, col1, rowY + 14, {
          width: width * 0.58,
          lineGap: 1,
        });
    }

    doc.y = rowY + rowHeight - 4;
    resetCursor(doc);
  });

  doc.moveDown(0.4);
  resetCursor(doc);
}

function generatePrintXrayInvoicePdf(data = {}) {
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
    writeCenteredTitle(doc, "XRay Invoice");
    writeSectionHeading(doc, "Patient Information");

    writeInfoLine(doc, "Customer:", data.customer);
    writeInfoLine(doc, "Requested By:", data.requestedBy);
    if (data.specificDoctor) {
      writeInfoLine(doc, "Specific Doctor:", data.specificDoctor);
    }
    writeInfoLine(doc, "Your File #:", data.yourFileNumber);
    writeInfoLine(doc, "Our Case #:", data.ourCaseNumber);
    writeInfoLine(doc, "Applicant:", data.applicant);
    writeInfoLine(doc, "DOB:", data.dob);
    writeInfoLine(doc, "Exam Date:", data.examDate);

    doc.moveDown(0.4);
    resetCursor(doc);

    writeBodyParagraph(
      doc,
      "The following charges are for XRay exam views.",
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
    drawXrayFeeTable(doc, feeLines);

    writeFooterAsteriskLine(
      doc,
      "Please make check or Money order payable to Document Management Services"
    );
    writeFooterEmailLine(doc);

    doc.end();
  });
}

module.exports = {
  generatePrintXrayInvoicePdf,
};
