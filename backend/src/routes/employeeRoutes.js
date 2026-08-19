const express = require("express");
const employeeController = require("../controllers/employeeController");
const authController = require("../controllers/authController");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { authorizeSelfOrAdmin } = require("../middleware/roleMiddleware");
const { authImpersonateRateLimit } = require("../middleware/authRateLimitMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("Admin", "Manager"), employeeController.getAll);
router.get(
  "/me/milestone-stats",
  authorize("Admin", "Manager", "Employee"),
  employeeController.getMyMilestoneStats
);
router.get(
  "/:id/milestone-stats",
  authorize("Admin", "Manager", "Employee"),
  authorizeSelfOrAdmin("id"),
  employeeController.getMilestoneStats
);
router.post("/", authorize("Admin"), employeeController.create);
router.put("/:id", authorize("Admin"), employeeController.update);
router.patch("/:id/terminate", authorize("Admin"), employeeController.terminate);
router.patch("/:id/activate", authorize("Admin"), employeeController.activate);
router.patch("/:id/suspend", authorize("Admin"), employeeController.suspend);
router.post(
  "/:id/impersonate",
  authorize("Admin"),
  authImpersonateRateLimit,
  authController.impersonate
);
router.delete("/:id", authorize("Admin"), employeeController.remove);

module.exports = router;
