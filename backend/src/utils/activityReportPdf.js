const PDFDocument = require("pdfkit");
const { SHEET_COMPANY_INFO } = require("../constants/sheetTemplateConstants");

const COLORS = {
  title: "#111827",
  muted: "#64748B",
  body: "#334155",
  accent: "#0097B2",
  headerBg: "#F8FAFC",
  border: "#E2E8F0",
  paid: "#059669",
};

function formatMoney(value) {
  const amount = Number(value);
  const safe = Number.isNaN(amount) ? 0 : amount;

  return `$${safe.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDisplayDate(value) {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function ensureSpace(doc, height = 48) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    doc.x = doc.page.margins.left;
  }
}

function drawHeader(doc, meta = {}) {
  const { left, width } = {
    left: doc.page.margins.left,
    width:
      doc.page.width - doc.page.margins.left - doc.page.margins.right,
  };

  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(COLORS.title)
    .text("DMS Custodian - Activity Report", left, doc.y, { width });

  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(SHEET_COMPANY_INFO.companyName, left, doc.y, { width });

  doc.moveDown(1);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.body)
    .text("Report Filters", left, doc.y);

  doc.moveDown(0.35);

  const filterLines = [
    ["Report Date", meta.dateFrom || "All"],
    ["Through Date", meta.dateTo || "All"],
    ["Facility", meta.facilityLabel || "All Facilities"],
    ["Activity", meta.activity || "All"],
    ["Search", meta.search || "—"],
    ["Generated On", formatDisplayDate(meta.generatedAt || new Date())],
  ];

  filterLines.forEach(([label, value]) => {
    ensureSpace(doc, 16);
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(`${label}: `, left, doc.y, { continued: true })
      .font("Helvetica")
      .fillColor(COLORS.body)
      .text(String(value));
  });

  doc.moveDown(0.8);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLORS.accent)
    .text(
      `${meta.facilityCount || 0} facilities  •  ${meta.totalCases || 0} total cases`,
      left,
      doc.y
    );

  doc.moveDown(0.8);
  doc
    .moveTo(left, doc.y)
    .lineTo(left + width, doc.y)
    .strokeColor(COLORS.border)
    .stroke();

  doc.moveDown(0.8);
}

function drawCompanySection(doc, company, contentLeft, contentWidth) {
  ensureSpace(doc, 72);

  const startY = doc.y;

  doc
    .rect(contentLeft, startY, contentWidth, 22)
    .fill(COLORS.headerBg);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLORS.title)
    .text(company.name || "Unknown Facility", contentLeft + 8, startY + 6, {
      width: contentWidth * 0.45,
    });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.body)
    .text(
      `Cases: ${company.cases || 0}`,
      contentLeft + contentWidth * 0.48,
      startY + 7,
      { width: contentWidth * 0.16, align: "right" }
    )
    .text(
      `Invoiced: ${company.invoicedDisplay || formatMoney(company.invoiced)}`,
      contentLeft + contentWidth * 0.64,
      startY + 7,
      { width: contentWidth * 0.18, align: "right" }
    )
    .fillColor(COLORS.paid)
    .text(
      `Paid: ${company.paidDisplay || formatMoney(company.paid)}`,
      contentLeft + contentWidth * 0.82,
      startY + 7,
      { width: contentWidth * 0.16, align: "right" }
    );

  doc.y = startY + 30;

  const columns = [
    { label: "Case", width: 0.18 },
    { label: "Applicant", width: 0.3 },
    { label: "Activity", width: 0.22 },
    { label: "Invoice Date", width: 0.14 },
    { label: "Amount", width: 0.16 },
  ];

  ensureSpace(doc, 24);
  const tableTop = doc.y;

  doc
    .rect(contentLeft, tableTop, contentWidth, 18)
    .fill("#EEF2F7");

  let columnX = contentLeft + 6;
  columns.forEach((column) => {
    const columnWidth = contentWidth * column.width - 8;
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(column.label, columnX, tableTop + 5, { width: columnWidth });
    columnX += contentWidth * column.width;
  });

  doc.y = tableTop + 22;

  const caseRows = company.caseRows || [];

  if (!caseRows.length) {
    ensureSpace(doc, 20);
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text("No case details available.", contentLeft + 6, doc.y);
    doc.moveDown(1);
    return;
  }

  caseRows.forEach((caseRow, index) => {
    ensureSpace(doc, 20);

    const rowY = doc.y;
    const rowHeight = 18;

    if (index % 2 === 1) {
      doc.rect(contentLeft, rowY, contentWidth, rowHeight).fill("#FCFEFF");
    }

    columnX = contentLeft + 6;
    const values = [
      caseRow.caseNo || "—",
      caseRow.applicant || "—",
      caseRow.activity || "—",
      caseRow.invoiceDate || "—",
      caseRow.amountDisplay || formatMoney(caseRow.amount),
    ];

    values.forEach((value, valueIndex) => {
      const columnWidth = contentWidth * columns[valueIndex].width - 8;
      doc
        .font(valueIndex === 0 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(8)
        .fillColor(valueIndex === 4 ? COLORS.title : COLORS.body)
        .text(String(value), columnX, rowY + 5, {
          width: columnWidth,
          align: valueIndex === 4 ? "right" : "left",
          ellipsis: true,
        });
      columnX += contentWidth * columns[valueIndex].width;
    });

    doc.y = rowY + rowHeight;
  });

  doc.moveDown(0.8);
}

function generateActivityReportPdf(report = {}, meta = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      layout: "landscape",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentLeft = doc.page.margins.left;
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    drawHeader(doc, {
      ...meta,
      facilityCount: report.summary?.facilityCount || 0,
      totalCases: report.summary?.totalCases || 0,
    });

    const companies = report.companies || [];

    if (!companies.length) {
      doc
        .font("Helvetica-Oblique")
        .fontSize(11)
        .fillColor(COLORS.muted)
        .text("No activity report data found for the selected filters.", contentLeft, doc.y);
    } else {
      companies.forEach((company) => {
        drawCompanySection(doc, company, contentLeft, contentWidth);
      });
    }

    const pageCount = doc.bufferedPageRange().count;
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      doc.switchToPage(pageIndex);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(
          `Page ${pageIndex + 1} of ${pageCount}`,
          contentLeft,
          doc.page.height - doc.page.margins.bottom + 12,
          {
            width: contentWidth,
            align: "right",
          }
        );
    }

    doc.end();
  });
}

module.exports = {
  generateActivityReportPdf,
};
