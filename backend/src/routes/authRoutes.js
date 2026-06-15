const express = require("express");
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", authController.login);
router.post("/verify-2fa", authController.verifyTwoFactor);
router.post("/resend-2fa", authController.resendTwoFactor);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

router.get("/me", authenticate, authController.me);

module.exports = router;
