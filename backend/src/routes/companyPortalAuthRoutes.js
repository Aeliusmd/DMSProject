const express = require("express");
const companyPortalAuthController = require("../controllers/companyPortalAuthController");
const {
  authenticateCompanyPortal,
} = require("../middleware/companyPortalAuthMiddleware");

const router = express.Router();

router.post("/register", companyPortalAuthController.register);
router.post("/login", companyPortalAuthController.login);
router.post("/verify-2fa", companyPortalAuthController.verifyTwoFactor);
router.post("/resend-2fa", companyPortalAuthController.resendTwoFactor);
router.post("/refresh", companyPortalAuthController.refresh);
router.post("/logout", companyPortalAuthController.logout);

router.post("/employee/login", companyPortalAuthController.employeeLogin);

router.get("/me", authenticateCompanyPortal, companyPortalAuthController.me);

module.exports = router;
