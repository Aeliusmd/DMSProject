const express = require("express");
const employeeController = require("../controllers/employeeController");

const router = express.Router();

router.get("/", employeeController.getAll);
router.get("/:id", employeeController.getById);
router.post("/", employeeController.create);
router.put("/:id", employeeController.update);
router.delete("/:id", employeeController.remove);
router.patch("/:id/terminate", employeeController.terminate);
router.patch("/:id/activate", employeeController.activate);

module.exports = router;
