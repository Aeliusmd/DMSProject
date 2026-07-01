const express = require("express");
const employeeController = require("../controllers/employeeController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("Admin", "Manager"), employeeController.getAll);
router.post("/", authorize("Admin"), employeeController.create);
router.patch("/:id/terminate", authorize("Admin"), employeeController.terminate);
router.patch("/:id/activate", authorize("Admin"), employeeController.activate);
router.patch("/:id/suspend", authorize("Admin"), employeeController.suspend);
router.delete("/:id", authorize("Admin"), employeeController.remove);

module.exports = router;
