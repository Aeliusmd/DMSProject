const express = require("express");
const personalPortalAuthController = require("../controllers/personalPortalAuthController");
const {
  authenticatePersonalPortal,
} = require("../middleware/personalPortalAuthMiddleware");
const {
  authLoginRateLimit,
  authRegisterRateLimit,
  authTwoFactorVerifyRateLimit,
  authTwoFactorResendRateLimit,
  authRefreshRateLimit,
} = require("../middleware/authRateLimitMiddleware");

const router = express.Router();

router.post("/register", authRegisterRateLimit, personalPortalAuthController.register);
router.post("/login", authLoginRateLimit, personalPortalAuthController.login);
router.post(
  "/verify-2fa",
  authTwoFactorVerifyRateLimit,
  personalPortalAuthController.verifyTwoFactor
);
router.post(
  "/resend-2fa",
  authTwoFactorResendRateLimit,
  personalPortalAuthController.resendTwoFactor
);
router.post("/refresh", authRefreshRateLimit, personalPortalAuthController.refresh);
router.post("/logout", personalPortalAuthController.logout);

router.get("/me", authenticatePersonalPortal, personalPortalAuthController.me);
router.patch(
  "/email",
  authenticatePersonalPortal,
  personalPortalAuthController.updateEmail
);

module.exports = router;
