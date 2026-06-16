const { PDFDocument } = require("pdf-lib");

async function getPdfPageCount(pdfBuffer) {
  const doc = await PDFDocument.load(pdfBuffer);
  return doc.getPageCount();
}

/**
 * Extract inclusive page range from PDF (0-based indices, same as Python Separator).
 */
async function extractPageRange(pdfBuffer, startPage, endPage) {
  const source = await PDFDocument.load(pdfBuffer);
  const total = source.getPageCount();

  const start = Math.max(0, startPage);
  const end = Math.min(endPage, total - 1);

  if (start > end) {
    throw new Error(`Invalid page range: ${startPage}-${endPage}`);
  }

  const target = await PDFDocument.create();
  const indices = [];
  for (let i = start; i <= end; i += 1) {
    indices.push(i);
  }

  const copied = await target.copyPages(source, indices);
  copied.forEach((page) => target.addPage(page));

  return Buffer.from(await target.save());
}

module.exports = {
  getPdfPageCount,
  extractPageRange,
};
