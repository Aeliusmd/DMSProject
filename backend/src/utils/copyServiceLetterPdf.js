const PDFDocument = require("pdfkit");
const {
  SHEET_COMPANY_INFO,
  COPY_SERVICE_SIGNER,
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

function formatDisplayDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function addExpiryDate(sendDate) {
  const expires = new Date(sendDate);
  expires.setDate(expires.getDate() + 7);
  return expires;
}

function ensureSpace(doc, height = 48) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
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
    doc.moveDown(options.spacingAfter ?? 0.8);
    resetCursor(doc);
  }
}

function writeCenteredLine(doc, text, options = {}) {
  const { width, left } = getContentBox(doc);

  resetCursor(doc);
  doc
    .font(options.bold ? "Times-Bold" : options.italic ? "Times-Italic" : "Times-Roman")
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

function writeHeading(doc, text, { centered = false } = {}) {
  const { width, left } = getContentBox(doc);

  ensureSpace(doc, 40);
  resetCursor(doc);

  doc
    .font("Times-Bold")
    .fontSize(11)
    .fillColor("#111827")
    .text(text, left, doc.y, {
      width,
      align: centered ? "center" : "left",
      underline: !centered,
      lineGap: 1,
    });

  doc.moveDown(0.7);
  resetCursor(doc);
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
    spacingAfter: 0.1,
  });
  writeCenteredLine(
    doc,
    `OFFICE: ${SHEET_COMPANY_INFO.officePhone}    FAX: ${SHEET_COMPANY_INFO.fax}`,
    {
      fontSize: 10,
      color: "#64748B",
      spacingAfter: 1.2,
    }
  );
}

function writeIntroParagraph(doc, facilityName) {
  const { width, left } = getContentBox(doc);

  ensureSpace(doc, 48);
  resetCursor(doc);

  const prefix =
    "In response to your request for medical records, please be aware that ";
  const suffix =
    " has contracted with DMS, Inc. Records Management Services to handle their Release of Information responsibilities.";

  doc.font("Times-Roman").fontSize(11).fillColor("#111827");
  doc.text(prefix, left, doc.y, { width, continued: true, lineGap: 2 });
  doc.font("Times-Bold").text(facilityName, { continued: true, underline: true });
  // Width is set on the first continued segment; do not pass it again or text overflows right.
  doc.font("Times-Roman").text(suffix);

  doc.moveDown(0.8);
  resetCursor(doc);
}

function generateCopyServiceLetterPdf({
  facilityName,
  facilityAddressLines = [],
  applicantName,
  orderNumber,
  sendDate = new Date(),
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 54, bottom: 54, left: 54, right: 54 },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const expiresDate = addExpiryDate(sendDate);

    resetCursor(doc);
    drawLetterhead(doc);

    writeParagraph(doc, facilityName, { bold: true, spacingAfter: 0.2 });
    facilityAddressLines
      .filter(Boolean)
      .forEach((line) => writeParagraph(doc, line, { spacingAfter: 0.2 }));

    doc.moveDown(0.4);
    resetCursor(doc);

    writeParagraph(doc, `Re: ${applicantName}`, { bold: true, spacingAfter: 0.2 });
    writeParagraph(doc, `Reference No: ${orderNumber}`, { bold: true, spacingAfter: 1 });
    writeParagraph(doc, "Dear Copy Service:");
    writeIntroParagraph(doc, facilityName);

    writeHeading(doc, "***Fees to Make Records Available***", { centered: true });
    writeParagraph(
      doc,
      "Many physicians do not have the time or personnel to address HIPAA compliance. Therefore these private physicians choose not to deliver the records for inspection, and instead they have contracted us to assume their Release of Information responsibilities. §All Code section references will be to the California WCAB and Civil Code, unless otherwise specified."
    );

    writeHeading(doc, "No Copying Allowed");
    writeParagraph(
      doc,
      "Our clients have taken the step of taking their practice paperless, most of their files have been imaged, and therefore there is no copying involved. California statutes clearly specify that the fifteen dollars witness fee only applies when the requested records are delivered to the attorney's representative for inspection or photocopying."
    );

    writeHeading(doc, "Copies §8-44.1");
    writeParagraph(
      doc,
      "We will comply with all Subpoenas and Authorization by reproducing all the information requested and provide it within the time frame specified by Law. An affidavit signed certifying the authenticity of the records, stating under penalty of perjury that all records are provided and are true copies of the originals; will be also included. §If some records are withheld, that information will also be included."
    );

    writeHeading(doc, "Reasonable Cost §1563");
    writeParagraph(
      doc,
      "As used in this section, reasonable cost shall include, but not be limited to, the following specific costs: $0.20 per page for digital reproduction; reasonable clerical costs incurred in locating and making the records available to be billed at the maximum rate of twenty dollars ($24) per hour per person, computed on the basis of six dollars ($6) per quarter hour or fraction thereof."
    );

    writeHeading(doc, "Personal Appearance");
    writeParagraph(
      doc,
      "DMS, Inc. does not accept personal appearance subpoenas, those must be served directly to the actual person to appear."
    );

    writeHeading(doc, "Inactive Files");
    writeParagraph(
      doc,
      "Our client's inactive/closed files are currently in the process of being digitalized, the files that are not, are kept in an offsite storage facility, reasonable fees (§1563) for time in traveling and searching for the requested records will also apply."
    );

    writeHeading(doc, "Request Withdrawn");
    writeParagraph(
      doc,
      "If a subpoena is served to compel the production of records and is subsequently withdrawn, or is quashed, modified or limited on a motion made other than by the witness, the witness shall be entitled to reimbursement for all costs incurred in compliance with the subpoena to the time that the requesting party has notified the witness in writing; that the subpoena has been withdrawn, quashed or limited."
    );

    writeHeading(doc, "Evidence Code §1158");
    writeParagraph(
      doc,
      "We welcome patient requests directly, as well as requests made by third parties. Patients making direct requests can come to our offices with proper identification and his/her records will promptly be made available after a release is signed. Third parties will have to follow the procedures outlined by the law in making all requests."
    );
    writeParagraph(
      doc,
      'Please update your records, when requesting records at this facility and send your request to the attention of "DMS, Inc - Medical Records." DMS, Inc. Records Management Services handles all of the medical records at this office.'
    );

    doc.moveDown(1);
    resetCursor(doc);
    writeParagraph(doc, "Sincerely,");
    writeParagraph(doc, COPY_SERVICE_SIGNER.companyName, { bold: true, spacingAfter: 0.2 });
    writeParagraph(doc, COPY_SERVICE_SIGNER.department, { spacingAfter: 1 });
    writeParagraph(
      doc,
      `Sent on ${formatDisplayDate(sendDate)}. This letter expires on ${formatDisplayDate(expiresDate)} (7 days from send date).`,
      { fontSize: 9, spacingAfter: 0 }
    );

    doc.end();
  });
}

module.exports = {
  generateCopyServiceLetterPdf,
  addExpiryDate,
  formatDisplayDate,
};
