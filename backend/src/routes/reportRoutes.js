const express = require("express");
const reportController = require("../controllers/reportController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/orders", reportController.getOrdersReport);
router.get("/activity", reportController.getActivityReport);

module.exports = router;
