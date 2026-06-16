/**
 * File upload middleware (multer) for order documents.
 *
 * Files are stored on disk under backend/uploads in three folders:
 *   - unprocessed-subpoenas/  (reserved for the unprocessed/batch-scan queue)
 *   - processed/              (subpoena attached to an order at creation)
 *   - additional-documents/   (extra documents attached to an order)
 *
 * The relative path (e.g. "processed/1700000000-subpoena.pdf") is what gets
 * persisted to the database; the file is served at "/uploads/<relative>".
 */

const fs = require("fs");
const path = require("path");
const multer = require("multer");
const ApiError = require("../utils/ApiError");

const UPLOADS_ROOT = path.join(__dirname, "..", "..", "uploads");

const UPLOAD_DIRS = {
  unprocessedSubpoenas: path.join(UPLOADS_ROOT, "unprocessed-subpoenas"),
  processed: path.join(UPLOADS_ROOT, "processed"),
  additionalDocuments: path.join(UPLOADS_ROOT, "additional-documents"),
  orderNotes: path.join(UPLOADS_ROOT, "notes_attachments"),
};

// Map order form file fields to their destination folders.
// A subpoena uploaded while creating an order is immediately processed
// (linked to that order), so it lands in the processed folder.
const FIELD_DESTINATIONS = {
  subpoenaFile: UPLOAD_DIRS.processed,
  additionalDocumentFile: UPLOAD_DIRS.additionalDocuments,
  attachment: UPLOAD_DIRS.orderNotes,
};

function ensureUploadDirs() {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  Object.values(UPLOAD_DIRS).forEach((dir) => {
    fs.mkdirSync(dir, { recursive: true });
  });
}

ensureUploadDirs();

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

function sanitizeFileName(originalName) {
  const ext = path.extname(originalName);
  const base = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-|-$/g, "");

  return `${base || "file"}${ext.toLowerCase()}`;
}

const storage = multer.diskStorage({
  destination(_req, file, cb) {
    const dir = FIELD_DESTINATIONS[file.fieldname] || UPLOAD_DIRS.processed;
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${sanitizeFileName(file.originalname)}`);
  },
});

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new ApiError(400, "Only PDF, Word, JPG, or PNG files are allowed"));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadOrderFiles = upload.fields([
  { name: "subpoenaFile", maxCount: 1 },
  { name: "additionalDocumentFile", maxCount: 1 },
]);

const uploadNoteAttachment = upload.single("attachment");

function toRelativeStoragePath(file) {
  if (!file) return null;
  return path.relative(UPLOADS_ROOT, file.path).split(path.sep).join("/");
}

module.exports = {
  UPLOADS_ROOT,
  UPLOAD_DIRS,
  upload,
  uploadOrderFiles,
  uploadNoteAttachment,
  toRelativeStoragePath,
};
