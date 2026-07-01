const express = require("express");
const publicRecordDownloadController = require("../controllers/publicRecordDownloadController");

const router = express.Router();

router.get(
  "/records-download/:token",
  publicRecordDownloadController.getMetadata
);
router.get(
  "/records-download/:token/file",
  publicRecordDownloadController.download
);

module.exports = router;
