const path = require("path");
const multer = require("multer");
const { randomUUID } = require("crypto");
const { facilityUploadsDir, ensureUploadDirs } = require("../config/uploads");

ensureUploadDirs();

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const facilityDir = path.join(
      facilityUploadsDir,
      String(req.params.id || "unknown")
    );

    require("fs").mkdirSync(facilityDir, { recursive: true });
    cb(null, facilityDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "");
    cb(null, `${randomUUID()}${extension}`);
  },
});

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new Error("Unsupported file type"));
}

const facilityDocumentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

module.exports = {
  facilityDocumentUpload,
};
