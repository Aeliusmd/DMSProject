const fs = require("fs");
const path = require("path");
const { randomBytes } = require("crypto");
const archiver = require("archiver");
const ApiError = require("../utils/ApiError");
const {
  sendFileResponse,
  streamArchiveToResponse,
} = require("../utils/responseUtils");
const Order = require("../models/Order");
const OrderRecord = require("../models/OrderRecord");
const RecordDownloadLink = require("../models/RecordDownloadLink");
const { resolveOrderStorageAbsolutePath } = require("../utils/fileStorage");

const RECORD_TITLES = {
  medical: "Medical Records",
  billing: "Billing Records",
  employment: "Employment Records",
  xrays: "X-Rays",
  other: "Other Records",
};

const LINK_VALID_DAYS = 7;

function buildToken() {
  return randomBytes(32).toString("hex");
}

function addExpiryDate(fromDate = new Date()) {
  const expires = new Date(fromDate);
  expires.setDate(expires.getDate() + LINK_VALID_DAYS);
  return expires;
}

async function resolveOrderRecordFiles(order) {
  const records = await OrderRecord.findByOrderId(order.id);
  const withFiles = records.filter((record) => record.storage_path);
  const safeOrderNumber = `${order.order_number || order.id}`.replace(
    /[^\w.-]+/g,
    "_"
  );

  const files = [];
  const recordLabels = [];

  for (const record of withFiles) {
    const absolutePath = resolveOrderStorageAbsolutePath(record.storage_path);

    if (!absolutePath || !fs.existsSync(absolutePath)) {
      continue;
    }

    const typeSuffix = record.record_type || "records";
    recordLabels.push(RECORD_TITLES[record.record_type] || "Records");
    files.push({
      recordType: record.record_type,
      label: RECORD_TITLES[record.record_type] || "Records",
      filename: `${safeOrderNumber}-${typeSuffix}.pdf`,
      path: absolutePath,
    });
  }

  return { files, recordLabels };
}

async function createDownloadLinkForOrder(orderId) {
  const normalizedId = Number(orderId);

  if (!Number.isFinite(normalizedId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const order = await Order.findById(normalizedId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const { files } = await resolveOrderRecordFiles(order);
  if (!files.length) {
    throw new ApiError(
      400,
      "Records files not found. Scan records before sending email."
    );
  }

  const token = buildToken();
  const expiresAt = addExpiryDate(new Date());

  await RecordDownloadLink.create({
    orderId: normalizedId,
    token,
    expiresAt,
  });

  return {
    token,
    expiresAt,
    files,
  };
}

async function getValidLink(token) {
  const row = await RecordDownloadLink.findByToken(`${token || ""}`.trim());

  if (!row) {
    throw new ApiError(404, "Download link not found");
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new ApiError(410, "This download link has expired");
  }

  return row;
}

async function getDownloadMetadata(token) {
  const link = await getValidLink(token);
  const order = await Order.findById(link.order_id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const { files, recordLabels } = await resolveOrderRecordFiles(order);

  if (!files.length) {
    throw new ApiError(404, "Records are no longer available for download");
  }

  return {
    orderNumber: order.order_number || String(order.id),
    applicant:
      [order.applicant_first_name, order.applicant_last_name]
        .filter(Boolean)
        .join(" ") || "",
    expiresAt: link.expires_at,
    recordLabels,
    files: files.map((file) => ({
      recordType: file.recordType,
      label: file.label,
      filename: file.filename,
    })),
  };
}

async function streamDownloadByToken(token, res) {
  const link = await getValidLink(token);
  const order = await Order.findById(link.order_id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const { files } = await resolveOrderRecordFiles(order);

  if (!files.length) {
    throw new ApiError(404, "Records are no longer available for download");
  }

  const safeOrderNumber = `${order.order_number || order.id}`.replace(
    /[^\w.-]+/g,
    "_"
  );

  if (files.length === 1) {
    const file = files[0];
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.filename.replace(/"/g, "")}"`
    );
    await sendFileResponse(res, file.path);
    return;
  }

  const zipName = `${safeOrderNumber}-records.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${zipName.replace(/"/g, "")}"`
  );

  const archive = archiver("zip", { zlib: { level: 9 } });

  files.forEach((file) => {
    archive.file(file.path, { name: file.filename });
  });

  await streamArchiveToResponse(archive, res);
}

module.exports = {
  LINK_VALID_DAYS,
  addExpiryDate,
  createDownloadLinkForOrder,
  getDownloadMetadata,
  streamDownloadByToken,
  resolveOrderRecordFiles,
};
