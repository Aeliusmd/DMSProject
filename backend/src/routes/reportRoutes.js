const express = require("express");
const reportController = require("../controllers/reportController");

const router = express.Router();

router.get("/orders", reportController.getOrdersReport);
router.get("/activity", reportController.getActivityReport);

module.exports = router;
