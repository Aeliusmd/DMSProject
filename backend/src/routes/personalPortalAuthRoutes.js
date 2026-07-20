const express = require("express");
const personalPortalAuthController = require("../controllers/personalPortalAuthController");
const {
  authenticatePersonalPortal,
} = require("../middleware/personalPortalAuthMiddleware");

const router = express.Router();

router.post("/register", personalPortalAuthController.register);
router.post("/login", personalPortalAuthController.login);
router.post("/verify-2fa", personalPortalAuthController.verifyTwoFactor);
router.post("/resend-2fa", personalPortalAuthController.resendTwoFactor);
router.post("/refresh", personalPortalAuthController.refresh);
router.post("/logout", personalPortalAuthController.logout);

router.get("/me", authenticatePersonalPortal, personalPortalAuthController.me);
router.patch(
  "/email",
  authenticatePersonalPortal,
  personalPortalAuthController.updateEmail
);

module.exports = router;
