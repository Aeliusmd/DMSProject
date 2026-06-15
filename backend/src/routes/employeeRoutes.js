const express = require("express");
const employeeController = require("../controllers/employeeController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate, authorize("Admin"));

router.get("/", employeeController.getAll);
router.post("/", employeeController.create);
router.patch("/:id/terminate", employeeController.terminate);
router.patch("/:id/activate", employeeController.activate);
router.delete("/:id", employeeController.remove);

module.exports = router;
