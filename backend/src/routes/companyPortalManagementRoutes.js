const express = require("express");
const companyPortalManagementController = require("../controllers/companyPortalManagementController");
const {
  authenticateCompanyPortal,
  requireCompanyAdmin,
} = require("../middleware/companyPortalAuthMiddleware");

const router = express.Router();

router.use(authenticateCompanyPortal, requireCompanyAdmin);

router.get("/employees", companyPortalManagementController.listEmployees);
router.post("/employees", companyPortalManagementController.createEmployee);

router.get("/wallet", companyPortalManagementController.getWalletSummary);
router.post("/wallet/topup", companyPortalManagementController.createTopupCheckout);
router.post(
  "/wallet/confirm-topup",
  companyPortalManagementController.confirmTopup
);
router.post(
  "/wallet/allocate",
  companyPortalManagementController.allocateToEmployee
);

module.exports = router;
