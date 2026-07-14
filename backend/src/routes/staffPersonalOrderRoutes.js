const express = require("express");
const staffPersonalOrderController = require("../controllers/staffPersonalOrderController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/stats", staffPersonalOrderController.getStats);

module.exports = router;
