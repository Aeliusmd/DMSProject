const fs = require("fs");
const path = require("path");
const config = require("../config");

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

module.exports = {
  getFileServerRoot,
  ensureFileServerReady,
  getBatchScanDir,
  sanitizeFileStem,
  saveBatchScanFile,
  resolveAbsolutePath,
};
