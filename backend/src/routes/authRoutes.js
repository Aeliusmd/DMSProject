const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/login", authController.login);
router.post("/verify-2fa", authController.verifyTwoFactor);
router.post("/resend-2fa", authController.resendTwoFactor);
router.post("/logout", authController.logout);

module.exports = router;
