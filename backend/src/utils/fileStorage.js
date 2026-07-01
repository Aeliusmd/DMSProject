const fs = require("fs");
const path = require("path");
const config = require("../config");
const { ORDER_UPLOAD_DIRS, ORDER_UPLOADS_ROOT } = require("../middleware/uploadMiddleware");

function getFileServerRoot() {
  const root = config.fileServer;
  if (!root) {
    throw new Error("FILE_SERVER is not configured in environment");
  }
  return path.resolve(root);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureFileServerReady() {
  const root = getFileServerRoot();
  ensureDir(root);
  return root;
}

function getBatchScanDir(userId) {
  return path.join("Order", "BatchScan", String(userId)).replace(/\\/g, "/");
}

function sanitizeFileStem(fileName) {
  const stem = path.basename(fileName, path.extname(fileName));
  const safe = stem.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
  return (safe || "upload").slice(0, 80);
}

/**
 * Save a file under Order/BatchScan/{userId}/
 */
function saveBatchScanFile(userId, fileName, buffer) {
  ensureFileServerReady();
  const root = getFileServerRoot();
  const relativeDir = getBatchScanDir(userId);
  const absoluteDir = path.join(root, ...relativeDir.split("/"));
  ensureDir(absoluteDir);

  const safeName = path.basename(fileName).replace(/[^\w.\-]+/g, "_");
  const absolutePath = path.join(absoluteDir, safeName);
  fs.writeFileSync(absolutePath, buffer);

  return {
    absolutePath,
    relativePath: `${relativeDir}/${safeName}`.replace(/\\/g, "/"),
    fileName: safeName,
  };
}

function resolveAbsolutePath(relativePath) {
  return path.join(getFileServerRoot(), ...relativePath.split("/"));
}

function isUploadsRelativePath(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  return (
    normalized.startsWith("processed/") ||
    normalized.startsWith("unprocessed-subpoenas/") ||
    normalized.startsWith("additional-documents/") ||
    normalized.startsWith("notes_attachments/") ||
    normalized.startsWith("medical-records/")
  );
}

/**
 * Move a batch-scan subpoena PDF from FILE_SERVER into uploads/processed/.
 * Returns the relative path stored on orders.subpoena_storage_path.
 */
function archiveBatchScanSubpoenaToProcessed(batchScanRelativePath, orderNumber) {
  const sourceAbsolute = resolveAbsolutePath(batchScanRelativePath);
  if (!fs.existsSync(sourceAbsolute)) {
    throw new Error(`Subpoena file not found: ${batchScanRelativePath}`);
  }

  fs.mkdirSync(ORDER_UPLOAD_DIRS.processed, { recursive: true });

  const stem = path.basename(batchScanRelativePath, path.extname(batchScanRelativePath));
  const safeStem = stem.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "subpoena";
  const safeOrder = String(orderNumber || "order").replace(/[^\w.\-]+/g, "_");
  const fileName = `${safeOrder}_${Date.now()}_${safeStem}.pdf`;
  const destAbsolute = path.join(ORDER_UPLOAD_DIRS.processed, fileName);

  fs.renameSync(sourceAbsolute, destAbsolute);

  return `processed/${fileName}`.replace(/\\/g, "/");
}

function resolveOrderStorageAbsolutePath(storagePath) {
  const normalized = String(storagePath || "").replace(/\\/g, "/");
  if (!normalized) return null;

  if (isUploadsRelativePath(normalized)) {
    return path.join(ORDER_UPLOADS_ROOT, normalized);
  }

  return resolveAbsolutePath(normalized);
}

module.exports = {
  getFileServerRoot,
  ensureFileServerReady,
  getBatchScanDir,
  sanitizeFileStem,
  saveBatchScanFile,
  resolveAbsolutePath,
  isUploadsRelativePath,
  resolveOrderStorageAbsolutePath,
  archiveBatchScanSubpoenaToProcessed,
};
