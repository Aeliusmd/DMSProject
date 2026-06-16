const express = require("express");
const activityLogController = require("../controllers/activityLogController");

const router = express.Router();

router.get("/", activityLogController.getAll);
router.get("/:id", activityLogController.getById);

module.exports = router;
