const express = require("express");
const dashboardController = require("../controllers/dashboardController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/stats", dashboardController.getStats);
router.get("/top-providers", dashboardController.getTopProviders);

module.exports = router;
