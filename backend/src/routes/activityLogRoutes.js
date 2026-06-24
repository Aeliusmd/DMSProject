const express = require("express");
const activityLogController = require("../controllers/activityLogController");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { authorizeSelfOrAdmin } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/me", activityLogController.getMyLogs);
router.get("/", activityLogController.list);

router.get(
  "/employees/:employeeId",
  authorizeSelfOrAdmin("employeeId"),
  activityLogController.getEmployeeLogs
);

router.get(
  "/:id",
  authorize("Admin"),
  activityLogController.getById
);

module.exports = router;
