const fs = require("fs");
const ApiError = require("./ApiError");
const { getPdfPageCount } = require("./pdfSplit");

const XRAY_RECORD_TYPE = "xrays";

function toStoredPageCount(value) {
  const pages = Number(value);
  if (!Number.isFinite(pages) || pages < 0) return 0;
  return Math.floor(pages);
}

function sumStoredPageCount(orderRecords = [], options = {}) {
  const { recordTypes = null, excludeTypes = [] } = options;
  const exclude = new Set(excludeTypes);
  const includeTypes = recordTypes ? new Set(recordTypes) : null;

  return orderRecords.reduce((sum, row) => {
    if (!row?.storage_path) return sum;

    const type = `${row.record_type || ""}`.trim().toLowerCase();
    if (exclude.has(type)) return sum;
    if (includeTypes && !includeTypes.has(type)) return sum;

    return sum + toStoredPageCount(row.page_count);
  }, 0);
}

function sumRegularInvoicePageCount(orderRecords = []) {
  return sumStoredPageCount(orderRecords, { excludeTypes: [XRAY_RECORD_TYPE] });
}

function sumXrayInvoicePageCount(orderRecords = []) {
  return sumStoredPageCount(orderRecords, { recordTypes: [XRAY_RECORD_TYPE] });
}

async function resolvePdfPageCountFromUpload(file) {
  if (!file) {
    throw new ApiError(400, "Records PDF is required");
  }

  let buffer = null;

  if (file.buffer) {
    buffer = file.buffer;
  } else if (file.path && fs.existsSync(file.path)) {
    buffer = await fs.promises.readFile(file.path);
  }

  if (!buffer?.length) {
    throw new ApiError(400, "Could not read uploaded PDF");
  }

  try {
    return toStoredPageCount(await getPdfPageCount(buffer));
  } catch {
    throw new ApiError(400, "Could not read PDF page count. Please upload a valid PDF.");
  }
}

module.exports = {
  XRAY_RECORD_TYPE,
  toStoredPageCount,
  sumStoredPageCount,
  sumRegularInvoicePageCount,
  sumXrayInvoicePageCount,
  resolvePdfPageCountFromUpload,
};
