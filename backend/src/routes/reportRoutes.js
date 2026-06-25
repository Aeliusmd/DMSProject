const express = require("express");
const reportController = require("../controllers/reportController");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { denyRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/orders", denyRoles("Employee"), reportController.getOrdersReport);
router.get(
  "/activity",
  authorize("Admin"),
  reportController.getActivityReport
);

module.exports = router;
