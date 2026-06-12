const express = require("express");
const notificationController = require("../controllers/notificationController");

const router = express.Router();

router.get("/", notificationController.getAll);
router.patch("/:id/read", notificationController.markAsRead);
router.patch("/read-all", notificationController.markAllAsRead);

module.exports = router;
