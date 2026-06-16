const express = require("express");
const activityLogController = require("../controllers/activityLogController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("Admin"), activityLogController.getAll);

router.get(
  "/employees/:employeeId",
  authorize("Admin"),
  activityLogController.getEmployeeLogs
);

router.get(
  "/:id",
  authorize("Admin"),
  activityLogController.getById
);

module.exports = router;
