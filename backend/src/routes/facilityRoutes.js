const express = require("express");
const facilityController = require("../controllers/facilityController");

const router = express.Router();

router.get("/", facilityController.getAll);
router.get("/:id", facilityController.getById);
router.post("/", facilityController.create);
router.put("/:id", facilityController.update);
router.delete("/:id", facilityController.remove);

router.get("/:id/users", facilityController.getUsers);
router.post("/:id/users", facilityController.createUser);
router.delete("/:id/users/:userId", facilityController.deleteUser);

module.exports = router;
