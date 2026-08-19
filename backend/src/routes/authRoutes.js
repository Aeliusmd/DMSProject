const express = require("express");
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");
const {
  authLoginRateLimit,
  authTwoFactorVerifyRateLimit,
  authTwoFactorResendRateLimit,
  authRefreshRateLimit,
  authImpersonateExchangeRateLimit,
} = require("../middleware/authRateLimitMiddleware");

const router = express.Router();

router.post("/login", authLoginRateLimit, authController.login);
router.post(
  "/forgot-password",
  authLoginRateLimit,
  authController.forgotPassword
);
router.post(
  "/forgot-password/verify",
  authTwoFactorVerifyRateLimit,
  authController.verifyForgotPassword
);
router.post(
  "/forgot-password/resend",
  authTwoFactorResendRateLimit,
  authController.resendForgotPassword
);
router.post(
  "/verify-2fa",
  authTwoFactorVerifyRateLimit,
  authController.verifyTwoFactor
);
router.post(
  "/resend-2fa",
  authTwoFactorResendRateLimit,
  authController.resendTwoFactor
);
router.post("/refresh", authRefreshRateLimit, authController.refresh);
router.post("/logout", authController.logout);
router.post(
  "/impersonate/exchange",
  authImpersonateExchangeRateLimit,
  authController.exchangeImpersonation
);

router.get("/me", authenticate, authController.me);

module.exports = router;
