const express = require("express");
const publicRecordDownloadController = require("../controllers/publicRecordDownloadController");
const stripePublicController = require("../controllers/stripePublicController");

const router = express.Router();

router.get(
  "/records-download/:token",
  publicRecordDownloadController.getMetadata
);
router.get(
  "/records-download/:token/file",
  publicRecordDownloadController.download
);

router.get("/pay/:token", stripePublicController.getPaymentPage);
router.post("/pay/:token/checkout", stripePublicController.createCheckout);
router.get("/pay/:token/result", stripePublicController.getCheckoutResult);
router.get(
  "/pay/receipt/:sessionId",
  stripePublicController.downloadReceipt
);

module.exports = router;
