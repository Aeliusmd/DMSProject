const express = require("express");
const companyPortalManagementController = require("../controllers/companyPortalManagementController");
const companyPortalActivityLogController = require("../controllers/companyPortalActivityLogController");
const {
  authenticateCompanyPortal,
  requireCompanyAdmin,
} = require("../middleware/companyPortalAuthMiddleware");

const router = express.Router();

router.use(authenticateCompanyPortal);

router.get(
  "/activity-log",
  requireCompanyAdmin,
  companyPortalActivityLogController.list
);

router.get(
  "/employees",
  requireCompanyAdmin,
  companyPortalManagementController.listEmployees
);
router.post(
  "/employees",
  requireCompanyAdmin,
  companyPortalManagementController.createEmployee
);

router.get(
  "/wallet",
  requireCompanyAdmin,
  companyPortalManagementController.getWalletSummary
);
router.get(
  "/wallet/transactions",
  requireCompanyAdmin,
  companyPortalManagementController.listWalletTransactions
);
router.post(
  "/wallet/topup",
  requireCompanyAdmin,
  companyPortalManagementController.createTopupCheckout
);
router.post(
  "/wallet/confirm-topup",
  requireCompanyAdmin,
  companyPortalManagementController.confirmTopup
);
router.post(
  "/wallet/allocate",
  requireCompanyAdmin,
  companyPortalManagementController.allocateToEmployee
);

module.exports = router;
