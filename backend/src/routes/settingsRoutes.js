const express = require("express");
const settingsController = require("../controllers/settingsController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/", settingsController.getSettings);
router.put("/profile", settingsController.updateProfile);
router.put("/notifications", settingsController.updateNotifications);
router.put("/password", settingsController.changePassword);

module.exports = router;
