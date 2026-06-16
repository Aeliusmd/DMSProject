const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { randomUUID } = require("crypto");
const ApiError = require("../utils/ApiError");
const { facilityUploadsDir, ensureUploadDirs } = require("../config/uploads");

/**
 * Facility document uploads:
 * Stored inside facility-specific folder:
 * uploads/facilities/<facilityId>/
 */

/**
 * Order document uploads:
 * Stored inside:
 * uploads/unprocessed-subpoenas/
 * uploads/processed/
 * uploads/additional-documents/
 * uploads/notes_attachments/
 */

const ORDER_UPLOADS_ROOT = path.join(__dirname, "..", "..", "uploads");

const ORDER_UPLOAD_DIRS = {
  unprocessedSubpoenas: path.join(ORDER_UPLOADS_ROOT, "unprocessed-subpoenas"),
  processed: path.join(ORDER_UPLOADS_ROOT, "processed"),
  additionalDocuments: path.join(ORDER_UPLOADS_ROOT, "additional-documents"),
  orderNotes: path.join(ORDER_UPLOADS_ROOT, "notes_attachments"),
};

const FIELD_DESTINATIONS = {
  subpoenaFile: ORDER_UPLOAD_DIRS.processed,
  additionalDocumentFile: ORDER_UPLOAD_DIRS.additionalDocuments,
  attachment: ORDER_UPLOAD_DIRS.orderNotes,
};

function ensureOrderUploadDirs() {
  fs.mkdirSync(ORDER_UPLOADS_ROOT, { recursive: true });

  Object.values(ORDER_UPLOAD_DIRS).forEach((dir) => {
    fs.mkdirSync(dir, { recursive: true });
  });
}

ensureUploadDirs();
ensureOrderUploadDirs();

const FACILITY_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const ORDER_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

function sanitizeFileName(originalName) {
  const ext = path.extname(originalName || "");
  const base = path
    .basename(originalName || "file", ext)
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-|-$/g, "");

  return `${base || "file"}${ext.toLowerCase()}`;
}

/**
 * Facility upload storage
 */
const facilityStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const facilityDir = path.join(
      facilityUploadsDir,
      String(req.params.id || "unknown")
    );

    fs.mkdirSync(facilityDir, { recursive: true });
    cb(null, facilityDir);
  },

  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${randomUUID()}${extension}`);
  },
});

function facilityFileFilter(_req, file, cb) {
  if (FACILITY_ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new ApiError(400, "Unsupported file type"));
}

const facilityDocumentUpload = multer({
  storage: facilityStorage,
  fileFilter: facilityFileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

/**
 * Order / subpoena / note attachment storage
 */
const orderStorage = multer.diskStorage({
  destination(_req, file, cb) {
    const dir = FIELD_DESTINATIONS[file.fieldname] || ORDER_UPLOAD_DIRS.processed;
    cb(null, dir);
  },

  filename(_req, file, cb) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${sanitizeFileName(file.originalname)}`);
  },
});

function orderFileFilter(_req, file, cb) {
  if (ORDER_ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new ApiError(400, "Only PDF, Word, JPG, or PNG files are allowed"));
}

const orderUpload = multer({
  storage: orderStorage,
  fileFilter: orderFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const uploadOrderFiles = orderUpload.fields([
  { name: "subpoenaFile", maxCount: 1 },
  { name: "additionalDocumentFile", maxCount: 1 },
]);

const uploadNoteAttachment = orderUpload.single("attachment");

function toRelativeStoragePath(file) {
  if (!file) return null;
  return path.relative(ORDER_UPLOADS_ROOT, file.path).split(path.sep).join("/");
}

module.exports = {
  facilityDocumentUpload,

  ORDER_UPLOADS_ROOT,
  ORDER_UPLOAD_DIRS,
  orderUpload,
  uploadOrderFiles,
  uploadNoteAttachment,
  toRelativeStoragePath,
};