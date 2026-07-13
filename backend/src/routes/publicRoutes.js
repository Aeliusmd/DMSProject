const express = require("express");
const publicRecordDownloadController = require("../controllers/publicRecordDownloadController");
const stripePublicController = require("../controllers/stripePublicController");
const personalPortalController = require("../controllers/personalPortalController");
const { uploadPersonalPortalLicense } = require("../middleware/uploadMiddleware");

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

router.get("/personal-request/config", personalPortalController.getConfig);
router.get(
  "/personal-request/facilities",
  personalPortalController.searchFacilities
);
router.post("/personal-request/verify-email", personalPortalController.sendEmailOtp);
router.post("/personal-request/confirm-email", personalPortalController.confirmEmailOtp);
router.post(
  "/personal-request/submit",
  uploadPersonalPortalLicense,
  personalPortalController.submitRequest
);
router.get("/personal-request/result", personalPortalController.getCheckoutResult);
router.post("/personal-request/status", personalPortalController.lookupStatus);

module.exports = router;
