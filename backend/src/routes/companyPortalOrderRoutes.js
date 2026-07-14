const express = require("express");
const companyPortalOrderController = require("../controllers/companyPortalOrderController");
const {
  authenticateCompanyPortal,
} = require("../middleware/companyPortalAuthMiddleware");
const { uploadSinglePdf } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(authenticateCompanyPortal);

router.post(
  "/orders/upload-subpoena",
  uploadSinglePdf("file"),
  companyPortalOrderController.uploadSubpoena
);

router.get("/dashboard", companyPortalOrderController.getDashboard);
router.get("/orders", companyPortalOrderController.listOrders);
router.get(
  "/orders/track/:orderNumber",
  companyPortalOrderController.trackOrder
);
router.post("/orders/checkout", companyPortalOrderController.createCheckout);
router.post(
  "/orders/confirm-payment",
  companyPortalOrderController.confirmPayment
);

router.get("/orders/:orderId", companyPortalOrderController.getOrder);
router.get(
  "/orders/:orderId/subpoena",
  companyPortalOrderController.getSubpoenaFile
);
router.get(
  "/orders/:orderId/documents",
  companyPortalOrderController.downloadReleasedDocuments
);
router.get(
  "/orders/:orderId/payment-receipt",
  companyPortalOrderController.downloadPaymentReceipt
);

module.exports = router;
