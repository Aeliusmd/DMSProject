const express = require("express");
const companyPortalAuthController = require("../controllers/companyPortalAuthController");
const {
  authenticateCompanyPortal,
} = require("../middleware/companyPortalAuthMiddleware");
const {
  authLoginRateLimit,
  authRegisterRateLimit,
  authTwoFactorVerifyRateLimit,
  authTwoFactorResendRateLimit,
  authRefreshRateLimit,
} = require("../middleware/authRateLimitMiddleware");

const router = express.Router();

router.post("/register", authRegisterRateLimit, companyPortalAuthController.register);
router.post("/login", authLoginRateLimit, companyPortalAuthController.login);
router.post(
  "/verify-2fa",
  authTwoFactorVerifyRateLimit,
  companyPortalAuthController.verifyTwoFactor
);
router.post(
  "/resend-2fa",
  authTwoFactorResendRateLimit,
  companyPortalAuthController.resendTwoFactor
);
router.post("/refresh", authRefreshRateLimit, companyPortalAuthController.refresh);
router.post("/logout", companyPortalAuthController.logout);

router.post(
  "/employee/login",
  authLoginRateLimit,
  companyPortalAuthController.employeeLogin
);

router.get("/me", authenticateCompanyPortal, companyPortalAuthController.me);

module.exports = router;
