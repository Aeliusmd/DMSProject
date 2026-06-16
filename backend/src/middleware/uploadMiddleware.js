const multer = require("multer");
const ApiError = require("../utils/ApiError");

const PDF_MIME = "application/pdf";

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE_MB || 50) * 1024 * 1024,
  },
  fileFilter(_req, file, cb) {
    const isPdf =
      file.mimetype === PDF_MIME ||
      (file.originalname || "").toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return cb(new ApiError(400, "Only PDF files are allowed"));
    }
    cb(null, true);
  },
});

function uploadSinglePdf(fieldName = "file") {
  return memoryUpload.single(fieldName);
}

module.exports = {
  uploadSinglePdf,
};
